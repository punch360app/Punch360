import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createKioskQrCamera,kioskQrCopy,kioskQrText} from '../web/live/kiosk-qr-camera.js';

const kit=({codes=[],permission,clock=()=>0,decode}={})=>{
 const notices=[],scheduled=[],expiryQueue=[],tracks=[{stops:0,stop(){this.stops++}}],media={getTracks:()=>tracks};
 let detected=0;
 const camera=createKioskQrCamera({
  mediaDevices:{getUserMedia:permission|| (async request=>{
   assert.equal(request.audio,false);
   assert.equal(request.video.facingMode.ideal,'environment');
   return media;
  })},
  BarcodeDetector:class{
   constructor(opts){assert.deepEqual(opts,{formats:['qr_code']})}
   async detect(){detected++;return decode?decode():codes;}
  },
  notify:code=>notices.push(code),
  schedule:fn=>{scheduled.push(fn);return scheduled.length;},
  cancel(){},
  expire:fn=>{expiryQueue.push(fn);return expiryQueue.length;},
  cancelExpire(){},
  now:clock
 });
 const video={srcObject:null,playing:0,paused:0,async play(){this.playing++},pause(){this.paused++}};
 return {camera,video,tracks,notices,scheduled,expiryQueue,flush:async()=>{const next=scheduled.shift();if(next)await next()},expireNow:()=>expiryQueue.shift()?.(),get detected(){return detected}};
};

test('camera preview reads employee-presented QR but does not transmit or return the raw value',async()=>{
 const raw='punch-private-opaque-should-not-leak';
 const k=kit({codes:[{format:'qr_code',rawValue:raw}]});
 assert.equal(await k.camera.start(k.video),true);
 assert.equal(k.camera.active,true);
 await k.flush();
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,['read']);
 assert.equal(k.video.srcObject,null);
 assert.equal(k.tracks[0].stops,1);
 assert.equal(JSON.stringify(k.notices).includes(raw),false);
});
test('explicit stop closes the video track and prevents stale queued decode',async()=>{
 const k=kit({codes:[{format:'qr_code',rawValue:'opaque'}]});
 await k.camera.start(k.video);
 k.camera.stop();
 await k.flush();
 assert.equal(k.detected,0);
 assert.deepEqual(k.notices,[]);
 assert.equal(k.tracks[0].stops,1);
});
test('pending camera permission cannot reopen a camera after navigation',async()=>{
 let resolve;
 const wait=new Promise(done=>{resolve=done});
 const k=kit({permission:()=>wait});
 const pending=k.camera.start(k.video);
 k.camera.stop();
 resolve({getTracks:()=>k.tracks});
 assert.equal(await pending,false);
 assert.equal(k.camera.active,false);
 assert.equal(k.tracks[0].stops,1);
});
test('unsupported browser or denied permission never reports a punch',async()=>{
 const notes=[];
 const noDetector=createKioskQrCamera({mediaDevices:{getUserMedia:async()=>{throw Error('must not request')}},notify:code=>notes.push(code)});
 assert.equal(await noDetector.start({}),false);
 assert.deepEqual(notes,['unsupported']);
 const denied=kit({permission:async()=>{throw Error('permission denied')}});
 assert.equal(await denied.camera.start(denied.video),false);
 assert.deepEqual(denied.notices,['camera']);
});
test('decoder error stops the camera without retaining QR credentials',async()=>{
 const k=kit();await k.camera.start(k.video);
 const pending=k.scheduled.shift();
 // Bad browser implementations can throw while scanning. In this test, the
 // camera is already stopped before attempting an outdated callback.
 k.camera.stop();await pending();
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,[]);
});
test('after 30 seconds camera turns off with a neutral timeout',async()=>{
 let now=0;
 const k=kit({clock:()=>now});
 await k.camera.start(k.video);now=30000;
 await k.flush();
 assert.deepEqual(k.notices,['expired']);
 assert.equal(k.camera.active,false);
 assert.equal(k.tracks[0].stops,1);
});
test('no QR content is surfaced for arbitrary barcodes or malformed long data',async()=>{
 const k=kit({codes:[{format:'ean_13',rawValue:'123'},{format:'qr_code',rawValue:'x'.repeat(4097)}]});
 await k.camera.start(k.video);await k.flush();
 assert.deepEqual(k.notices,[]);
 assert.equal(k.camera.active,true);
 k.camera.stop();
});
test('camera instructions are complete for the ten kiosk locales',()=>{
 for(const language of ['fr','en','es','pt','it','de','ar','zh','hi','tl'])
  for(const key of ['open','help','title','scanning','close','unsupported','camera','decode','expired','read'])
   assert.equal(typeof kioskQrText(language,key),'string')&&assert.ok(kioskQrText(language,key).length>4);
 assert.equal(kioskQrText('unknown','close'),kioskQrCopy.en.close);
});

test('watchdog turns camera off even when native QR decode promise never resolves',async()=>{
 let complete;
 const pending=new Promise(resolve=>{complete=resolve});
 const k=kit({decode:()=>pending});
 assert.equal(await k.camera.start(k.video),true);
 const decode=k.flush();
 assert.equal(k.detected,1);
 k.expireNow();
 assert.equal(k.camera.active,false);
 assert.equal(k.video.srcObject,null);
 assert.equal(k.tracks[0].stops,1);
 assert.deepEqual(k.notices,['expired']);
 complete([{format:'qr_code',rawValue:'private-after-expiry'}]);
 await decode;
 assert.deepEqual(k.notices,['expired'],'stale scan cannot report a QR after expiry');
 assert.equal(k.tracks[0].stops,1);
});

test('closing camera invalidates old watchdog without touching replacement session',async()=>{
 const k=kit();
 assert.equal(await k.camera.start(k.video),true);
 const oldExpiry=k.expiryQueue.shift();
 k.camera.stop();
 assert.equal(await k.camera.start(k.video),true);
 const newExpiry=k.expiryQueue.shift();
 oldExpiry();
 assert.equal(k.camera.active,true);
 assert.deepEqual(k.notices,[]);
 newExpiry();
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,['expired']);
 assert.equal(k.tracks[0].stops,2);
});

test('tablet camera hardware-ended event closes every track and reports neutral fallback',async()=>{
 const listeners=new Set(),notices=[];
 const tracks=[
  {stops:0,stop(){this.stops++},addEventListener(type,fn){if(type==='ended')listeners.add(fn)},removeEventListener(type,fn){if(type==='ended')listeners.delete(fn)}},
  {stops:0,stop(){this.stops++}}
 ];
 const media={getTracks:()=>tracks};
 const video={srcObject:null,async play(){},pause(){}};
 const camera=createKioskQrCamera({
  mediaDevices:{getUserMedia:async()=>media},
  BarcodeDetector:class{async detect(){return []}},
  notify:key=>notices.push(key),
  schedule:()=>1,cancel(){},
  expire:()=>2,cancelExpire(){}
 });
 assert.equal(await camera.start(video),true);
 assert.equal(camera.active,true);
 assert.equal(listeners.size,1);
 for(const listener of [...listeners])listener();
 assert.equal(camera.active,false);
 assert.equal(video.srcObject,null);
 assert.deepEqual(tracks.map(x=>x.stops),[1,1]);
 assert.deepEqual(notices,['camera']);
 assert.equal(listeners.size,0,'ended handlers must be removed on stop');
});

test('old track-ended callback cannot stop a replacement camera session',async()=>{
 const streams=[],oldListeners=[],notices=[];
 const mediaDevices={async getUserMedia(){
  const handlers=new Set();
  const track={stops:0,stop(){this.stops++},addEventListener(_,fn){handlers.add(fn)},removeEventListener(_,fn){handlers.delete(fn)}};
  const stream={track,handlers,getTracks:()=>[track]};streams.push(stream);return stream;
 }};
 const camera=createKioskQrCamera({
  mediaDevices,BarcodeDetector:class{async detect(){return []}},
  schedule:()=>1,cancel(){},expire:()=>2,cancelExpire(){},
  notify:key=>notices.push(key)
 });
 const video={srcObject:null,async play(){},pause(){}};
 assert.equal(await camera.start(video),true);
 oldListeners.push(...streams[0].handlers);
 camera.stop();
 assert.equal(streams[0].handlers.size,0);
 assert.equal(await camera.start(video),true);
 for(const callback of oldListeners)callback();
 assert.equal(camera.active,true);
 assert.equal(streams[1].track.stops,0);
 assert.deepEqual(notices,[]);
 camera.stop();
 assert.equal(streams[1].handlers.size,0);
 assert.equal(streams[1].track.stops,1);
});
