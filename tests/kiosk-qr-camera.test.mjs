import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 const raw='P360C1.'+'a'.repeat(64);
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
test('unrelated QR codes, URLs, uppercase and malformed employee cards are ignored',async()=>{
 const invalid=[
  'https://example.test/user?token=private',
  'P360C1.'+'A'.repeat(64),
  'P360C1.'+'a'.repeat(63),
  'P360C1.'+'a'.repeat(65),
  'P360C1_'+'a'.repeat(64),
  'P360C1.'+'a'.repeat(63)+'x',
  'P360C1.'+'a'.repeat(64)+'\\n',
  'P360C2.'+'a'.repeat(64)
 ];
 const k=kit({codes:[{format:'ean_13',rawValue:'1234567890123'},...invalid.map(rawValue=>({format:'qr_code',rawValue}))]});
 await k.camera.start(k.video);
 await k.flush();
 assert.equal(k.camera.active,true);
 assert.deepEqual(k.notices,[]);
 assert.equal(k.tracks[0].stops,0);
 k.camera.stop();
 assert.equal(k.tracks[0].stops,1);
});

test('tablet ignores unrelated QR first and detects a valid employee card later',async()=>{
 const raw='P360C1.'+'b'.repeat(64);
 let calls=0;
 const k=kit({decode:()=>++calls===1?[{format:'qr_code',rawValue:'https://example.test'}]:[{format:'qr_code',rawValue:raw}]});
 await k.camera.start(k.video);
 await k.flush();
 assert.equal(k.camera.active,true);
 assert.deepEqual(k.notices,[]);
 await k.flush();
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,['read']);
 assert.equal(JSON.stringify(k.notices).includes(raw),false);
 assert.equal(k.video.srcObject,null);
 assert.equal(k.tracks[0].stops,1);
});

test('unsupported native QR format does not request tablet camera permission',async()=>{
 const notices=[];let permissions=0;
 const Detector=class{
  static async getSupportedFormats(){return ['ean_13','code_128']}
  constructor(){throw Error('QR constructor must not run')}
 };
 const camera=createKioskQrCamera({
  BarcodeDetector:Detector,
  mediaDevices:{async getUserMedia(){permissions++;throw Error('must not request camera')}},
  notify:code=>notices.push(code),
  expire:()=>1,cancelExpire(){}
 });
 assert.equal(await camera.start({}),false);
 assert.equal(camera.active,false);
 assert.equal(permissions,0);
 assert.deepEqual(notices,['unsupported']);
});

test('supported native QR format starts local preview and retains ordinary cancellation',async()=>{
 const notices=[],tracks=[{stops:0,stop(){this.stops++}}];let permissions=0;
 const Detector=class{
  static async getSupportedFormats(){return ['ean_13','qr_code']}
  async detect(){return []}
 };
 const video={srcObject:null,async play(){},pause(){}};
 const camera=createKioskQrCamera({
  BarcodeDetector:Detector,
  mediaDevices:{async getUserMedia(){permissions++;return {getTracks:()=>tracks}}},
  notify:code=>notices.push(code),
  schedule:()=>1,cancel(){},expire:()=>2,cancelExpire(){}
 });
 assert.equal(await camera.start(video),true);
 assert.equal(permissions,1);
 assert.equal(camera.active,true);
 camera.stop();
 assert.equal(camera.active,false);
 assert.equal(video.srcObject,null);
 assert.equal(tracks[0].stops,1);
 assert.deepEqual(notices,[]);
});

test('stale native QR format check cannot ask for camera permission after close',async()=>{
 let resolveFormats;const formats=new Promise(resolve=>{resolveFormats=resolve});
 let permissions=0;const notices=[];
 const Detector=class{static getSupportedFormats(){return formats}};
 const camera=createKioskQrCamera({
  BarcodeDetector:Detector,
  mediaDevices:{async getUserMedia(){permissions++;throw Error('must never open camera')}},
  notify:code=>notices.push(code),expire:()=>1,cancelExpire(){}
 });
 const opening=camera.start({});
 camera.stop();
 resolveFormats(['qr_code']);
 assert.equal(await opening,false);
 assert.equal(permissions,0);
 assert.equal(camera.active,false);
 assert.deepEqual(notices,[]);
});

test('privacy deadline expires pending native QR capability check before camera access',async()=>{
 let resolveFormats;const formats=new Promise(resolve=>{resolveFormats=resolve});
 const expirations=[],notices=[];let permissions=0;
 const Detector=class{static getSupportedFormats(){return formats}};
 const camera=createKioskQrCamera({
  BarcodeDetector:Detector,
  mediaDevices:{async getUserMedia(){permissions++;throw Error('must never open camera')}},
  notify:code=>notices.push(code),
  expire:callback=>{expirations.push(callback);return expirations.length},
  cancelExpire(){}
 });
 const opening=camera.start({});
 assert.equal(expirations.length,1);
 expirations.shift()();
 assert.deepEqual(notices,['expired']);
 resolveFormats(['qr_code']);
 assert.equal(await opening,false);
 assert.equal(permissions,0);
 assert.equal(camera.active,false);
 assert.deepEqual(notices,['expired'],'stale capability response must not notify twice');
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
test('privacy deadline expires even while tablet camera permission remains pending',async()=>{
 let resolvePermission;
 const permission=new Promise(resolve=>{resolvePermission=resolve});
 const k=kit({permission:()=>permission});
 const opening=k.camera.start(k.video);
 assert.equal(k.expiryQueue.length,1,'deadline must be armed before permission resolves');
 k.expireNow();
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,['expired']);
 resolvePermission({getTracks:()=>k.tracks});
 assert.equal(await opening,false);
 assert.equal(k.tracks[0].stops,1,'late camera access must be released');
 assert.equal(k.video.srcObject,null);
 assert.deepEqual(k.notices,['expired'],'no second notification after late permission');
});

test('privacy deadline shuts off an acquired camera if video playback hangs',async()=>{
 let resolvePlayback,enteredPlayback;
 const playback=new Promise(resolve=>{resolvePlayback=resolve});
 const entered=new Promise(resolve=>{enteredPlayback=resolve});
 const k=kit();
 k.video.play=()=>{enteredPlayback();return playback};
 const opening=k.camera.start(k.video);
 await entered;
 assert.equal(k.video.srcObject!==null,true);
 assert.equal(k.camera.active,false,'camera is not ready before playback');
 k.expireNow();
 assert.equal(k.video.srcObject,null);
 assert.equal(k.tracks[0].stops,1);
 assert.deepEqual(k.notices,['expired']);
 resolvePlayback();
 assert.equal(await opening,false);
 assert.equal(k.camera.active,false);
 assert.deepEqual(k.notices,['expired']);
});

test('permission rejection clears pending watchdog and reports camera error only',async()=>{
 let rejectPermission;
 const permission=new Promise((_,reject)=>{rejectPermission=reject});
 const k=kit({permission:()=>permission});
 const opening=k.camera.start(k.video);
 assert.equal(k.expiryQueue.length,1);
 rejectPermission(Error('permission denied'));
 assert.equal(await opening,false);
 k.expireNow();
 assert.deepEqual(k.notices,['camera']);
 assert.equal(k.camera.active,false);
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

test('empty camera stream cannot start a phantom QR preview',async()=>{
 const notices=[],scheduled=[],video={srcObject:null,async play(){},pause(){}};
 const camera=createKioskQrCamera({
  mediaDevices:{async getUserMedia(){return {getTracks:()=>[]}}},
  BarcodeDetector:class{async detect(){throw Error('must not scan without video')}},
  notify:key=>notices.push(key),
  schedule:callback=>{scheduled.push(callback);return 1;},cancel(){},
  expire:()=>1,cancelExpire(){}
 });
 assert.equal(await camera.start(video),false);
 assert.equal(camera.active,false);
 assert.equal(video.srcObject,null);
 assert.deepEqual(notices,['camera']);
 assert.equal(scheduled.length,0);
});

test('audio-only or already-ended video stream is rejected before QR decoding',async()=>{
 for(const mode of ['audio-only','ended-video']){
  const notices=[],scheduled=[],tracks=[];
  const track={kind:mode==='audio-only'?'audio':'video',readyState:mode==='audio-only'?'live':'ended',
   stops:0,stop(){this.stops++},addEventListener(){},removeEventListener(){}};
  tracks.push(track);
  const stream={
   getTracks:()=>tracks,
   getVideoTracks:()=>mode==='audio-only'?[]:tracks
  };
  const video={srcObject:null,async play(){},pause(){}};
  const camera=createKioskQrCamera({
   mediaDevices:{async getUserMedia(){return stream}},
   BarcodeDetector:class{async detect(){throw Error('must not decode an unavailable video track')}},
   notify:key=>notices.push(key),
   schedule:fn=>{scheduled.push(fn);return 1;},cancel(){},
   expire:()=>2,cancelExpire(){}
  });
  assert.equal(await camera.start(video),false,mode);
  assert.equal(camera.active,false,mode);
  assert.equal(video.srcObject,null,mode);
  assert.deepEqual(notices,['camera'],mode);
  assert.equal(track.stops,1,mode);
  assert.equal(scheduled.length,0,mode);
 }
});

test('track ending while listener registers closes and detaches without stale preview',async()=>{
 const listeners=new Set(),notices=[],scheduled=[];
 const track={readyState:'live',stops:0,stop(){this.stops++},
  addEventListener(type,handler){if(type==='ended'){listeners.add(handler);this.readyState='ended';handler();}},
  removeEventListener(type,handler){if(type==='ended')listeners.delete(handler)}
 };
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const video={srcObject:null,async play(){},pause(){}};
 const camera=createKioskQrCamera({
  mediaDevices:{async getUserMedia(){return stream}},
  BarcodeDetector:class{async detect(){throw Error('must not decode after track ends')}},
  notify:key=>notices.push(key),
  schedule:fn=>{scheduled.push(fn);return 1;},cancel(){},
  expire:()=>2,cancelExpire(){}
 });
 assert.equal(await camera.start(video),false);
 assert.equal(camera.active,false);
 assert.equal(video.srcObject,null);
 assert.equal(track.stops,1);
 assert.equal(listeners.size,0,'ended listener must be removed immediately');
 assert.equal(scheduled.length,0);
 assert.deepEqual(notices,['camera']);
});

test('QR scanner owns its own timeout instead of inheriting an earlier PIN form idle timer',()=>{
 const kiosk=readFileSync(new URL('../web/live/kiosk.js',import.meta.url),'utf8');
 assert.match(kiosk,/if\(action==='scan-qr'\)\{[^\n]*clearTimeout\(timer\);state\.qrOpen=true/);
 assert.match(kiosk,/if\(action==='close-qr'\)\{[^\n]*qrCamera\.stop\(\);arm\(\);draw\(\)/);
 assert.match(kiosk,/notify:reason=>\{if\(!state\.qrOpen\)return;state\.qrOpen=false;state\.notice=qrLabel\(reason\);arm\(\);draw\(\)/);
});
