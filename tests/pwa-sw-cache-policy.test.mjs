import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
const scope='https://punch.example/Punch360/web/live/';

function workerHarness({offline=true}={}){
 const listeners={};
 const requests=[];
 const writes=[];
 const home={shell:'home'};
 const kiosk={shell:'kiosk'};
 const networkResponse={ok:true,clone:()=>({copied:true})};
 const caches={
  open:async()=>({put:async(request,response)=>{writes.push({request,response});}}),
  match:async request=>{
   if(request==='./index.html')return home;
   if(request==='./kiosk.html')return kiosk;
   return undefined;
  }
 };
 const self={
  registration:{scope},
  location:{origin:new URL(scope).origin},
  addEventListener:(name,listener)=>{listeners[name]=listener;}
 };
 runInNewContext(source,{
  URL,Set,Promise,self,caches,
  Response:{error:()=>({shell:'network-error'})},
  fetch:(request,options)=>{
   requests.push({url:request.url,options});
   return offline?Promise.reject(new Error('network unavailable')):Promise.resolve(networkResponse);
  }
 },{filename:'web/live/sw.js'});
 assert.equal(typeof listeners.fetch,'function','the service worker must register fetch');
 function dispatch(path,{mode='navigate',method='GET'}={}){
  let response;
  const lifetime=[];
  const request={url:new URL(path,scope).href,mode,method};
  listeners.fetch({
   request,
   respondWith:promise=>{response=promise;},
   waitUntil:promise=>lifetime.push(promise)
  });
  return {response,lifetime,request};
 }
 return {dispatch,requests,writes,home,kiosk,networkResponse};
}

test('unknown same-origin navigation is never rewritten into the offline employee shell',()=>{
 const worker=workerHarness();
 for(const path of ['./private/reports','./employee/123','./api/attendance.json?user=123']){
  const event=worker.dispatch(path);
  assert.equal(event.response,undefined,path+' must be left to the network');
 }
 assert.equal(worker.requests.length,0,'no unknown route may be intercepted');
});

test('home, index and kiosk continue to work offline, including query strings',async()=>{
 const worker=workerHarness();
 for(const path of ['./','./index.html?from=shortcut']){
  const event=worker.dispatch(path);
  assert.ok(event.response,'known home route must be intercepted');
  assert.equal(await event.response,worker.home);
 }
 const event=worker.dispatch('./kiosk.html?device=tablet');
 assert.ok(event.response,'kiosk route must be intercepted');
 assert.equal(await event.response,worker.kiosk);
 assert.equal(worker.writes.length,0,'offline navigation does not cache query-specific pages');
});

test('dynamic JSON, arbitrary scripts, other origins and non-GET requests bypass the cache',()=>{
 const worker=workerHarness();
 for(const [path,options] of [
  ['./employee-schedule.json',{mode:'cors'}],
  ['./not-precached.js',{mode:'cors'}],
  ['https://outside.example/Punch360/web/live/index.html',{mode:'navigate'}],
  ['./index.html',{mode:'navigate',method:'POST'}]
 ]){
  const event=worker.dispatch(path,options);
  assert.equal(event.response,undefined,path+' must not be intercepted');
 }
 assert.equal(worker.requests.length,0);
});

test('a successful public precached asset update is attached to the fetch lifetime',async()=>{
 const worker=workerHarness({offline:false});
 const event=worker.dispatch('./essential.js',{mode:'cors'});
 assert.ok(event.response,'precache entry must be handled');
 assert.equal(await event.response,worker.networkResponse);
 assert.equal(event.lifetime.length,1,'cache update must use waitUntil');
 await Promise.all(event.lifetime);
 assert.equal(worker.writes.length,1);
 assert.equal(worker.writes[0].request.url,event.request.url);
 assert.equal(worker.writes[0].response.copied,true);
 assert.equal(worker.requests[0].options.cache,'no-cache');
});
