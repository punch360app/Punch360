import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
const scope='https://punch.example/Punch360/web/live/';

function workerHarness({offline=true,httpStatus=200}={}){
 const listeners={};
 const requests=[];
 const writes=[];
 const home={shell:'home'};
 const kiosk={shell:'kiosk'};
 const asset={shell:'public-asset'};
 const networkResponse={ok:httpStatus>=200&&httpStatus<300,status:httpStatus,clone:()=>({copied:true})};
 const caches={
  open:async()=>({put:async(request,response)=>{writes.push({request,response});}}),
  match:async request=>{
   if(request==='./index.html')return home;
   if(request==='./kiosk.html')return kiosk;
   if(request?.url?.endsWith('/essential.js'))return asset;
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
 return {dispatch,requests,writes,home,kiosk,asset,networkResponse};
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

test('upstream gateway errors use the installed public shell and asset, never cache the outage page',async()=>{
 for(const status of [502,503,504]){
  const worker=workerHarness({offline:false,httpStatus:status});
  const home=worker.dispatch('./index.html?from=installed');
  const kiosk=worker.dispatch('./kiosk.html?device=tablet');
  const asset=worker.dispatch('./essential.js',{mode:'cors'});
  assert.equal(await home.response,worker.home,'HTTP '+status+' must use public home fallback');
  assert.equal(await kiosk.response,worker.kiosk,'HTTP '+status+' must use public kiosk fallback');
  assert.equal(await asset.response,worker.asset,'HTTP '+status+' must use precached public JS');
  await Promise.all([...home.lifetime,...kiosk.lifetime,...asset.lifetime]);
  assert.equal(worker.writes.length,0,'a gateway error must not poison the public cache');
 }
});

test('HTTP authorization and not-found responses remain visible, without a stale shell override',async()=>{
 for(const status of [401,403,404]){
  const worker=workerHarness({offline:false,httpStatus:status});
  const home=worker.dispatch('./index.html?from=installed');
  const asset=worker.dispatch('./essential.js',{mode:'cors'});
  assert.equal(await home.response,worker.networkResponse,'HTTP '+status+' must not be masked');
  assert.equal(await asset.response,worker.networkResponse,'HTTP '+status+' must not be masked');
  await Promise.all([...home.lifetime,...asset.lifetime]);
  assert.equal(worker.writes.length,0);
  const privateRoute=worker.dispatch('./private/reports');
  assert.equal(privateRoute.response,undefined);
 }
});
