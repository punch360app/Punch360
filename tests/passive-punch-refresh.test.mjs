import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createScopedPassivePunchRefresh} from '../web/live/passive-punch-refresh.js';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
function harness({
 online=true,authorizedId='user-A',role='employee',membership=true,busy=false,
 getUser=null,getCompany=null,refresh=null
}={}){
 const calls=[],scope={companyId:'company-A',userId:'user-A',role:'employee'};
 let inScope=true,isBusy=busy;
 const retry=createScopedPassivePunchRefresh({
  getScope:()=>inScope?{...scope}:null,
  isCurrent:captured=>inScope&&captured.companyId===scope.companyId&&
   captured.userId===scope.userId&&captured.role===scope.role,
  isOnline:()=>online,isBusy:()=>isBusy,
  getVerifiedUser:async()=>{calls.push('auth');return getUser?getUser():authorizedId},
  getMembership:async captured=>{calls.push('membership');return getCompany?getCompany(captured):
   membership?{company_id:captured.companyId,user_id:captured.userId,status:'active',role}:null},
  refresh:async captured=>{calls.push('refresh');return refresh?.(captured)}
 });
 return {retry,calls,scope,setScope:s=>Object.assign(scope,s),
  setBusy:v=>{isBusy=v},clearScope:()=>{inScope=false}};
}
test('online reconnect verifies identity and active company before flushing',async()=>{
 const h=harness();assert.equal(await h.retry(),true);
 assert.deepEqual(h.calls,['auth','membership','refresh']);
});
test('offline refresh remains usable without network authorization or RPC',async()=>{
 const h=harness({online:false});
 assert.equal(await h.retry(),true);
 assert.deepEqual(h.calls,['refresh']);
});
test('mismatched authenticated user refuses to send saved events',async()=>{
 const h=harness({authorizedId:'other-user'});
 assert.equal(await h.retry(),false);
 assert.deepEqual(h.calls,['auth']);
});
test('revoked membership refuses to flush the durable journal',async()=>{
 const h=harness({membership:false});
 assert.equal(await h.retry(),false);
 assert.deepEqual(h.calls,['auth','membership']);
});
test('changed role requires a newly verified workspace',async()=>{
 const h=harness({role:'boss'});
 assert.equal(await h.retry(),false);
 assert.deepEqual(h.calls,['auth','membership']);
});
test('switching company during auth check cancels reconnect refresh',async()=>{
 let release;
 const h=harness({getUser:()=>new Promise(resolve=>{release=resolve})});
 const pending=h.retry();h.setScope({companyId:'company-B'});
 release('user-A');
 assert.equal(await pending,false);
 assert.deepEqual(h.calls,['auth']);
});
test('switching company while membership lookup is pending cancels refresh',async()=>{
 let release;
 const h=harness({getCompany:()=>new Promise(resolve=>{release=resolve})});
 const pending=h.retry();await Promise.resolve();
 h.setScope({companyId:'company-B'});
 release({company_id:'company-A',user_id:'user-A',status:'active',role:'employee'});
 assert.equal(await pending,false);
 assert.deepEqual(h.calls,['auth','membership']);
});
test('concurrent online and visibility callbacks share one verification',async()=>{
 let release;
 const h=harness({getUser:()=>new Promise(resolve=>{release=resolve})});
 const first=h.retry(),second=h.retry(),third=h.retry();
 assert.equal(first,second);assert.equal(second,third);
 release('user-A');assert.equal(await first,true);
 assert.deepEqual(h.calls,['auth','membership','refresh']);
});
test('active punch prevents background refresh, but later retries succeed',async()=>{
 const h=harness({busy:true});
 assert.equal(await h.retry(),false);assert.deepEqual(h.calls,[]);
 h.setBusy(false);assert.equal(await h.retry(),true);
 assert.deepEqual(h.calls,['auth','membership','refresh']);
});
test('failed verification or network error never reports successful sync',async()=>{
 let reject=true;
 const h=harness({getUser:()=>{
  if(reject)throw Error('network');
  return 'user-A';
 }});
 assert.equal(await h.retry(),false);assert.deepEqual(h.calls,['auth']);
 reject=false;assert.equal(await h.retry(),true);
 assert.deepEqual(h.calls,['auth','auth','membership','refresh']);
});
test('Web online, foreground and periodic refresh paths all go through scoped gate',()=>{
 const start=app.indexOf('const passivePunchRefresh=');
 const end=app.indexOf('const locationLabel=',start);
 assert.ok(start>0&&end>start);
 const block=app.slice(start,end);
 assert.match(block,/getVerifiedUser:async/);
 assert.match(block,/getMembership:async scope/);
 assert.match(block,/\.eq\('status','active'\)\.maybeSingle\(\)/);
 assert.match(block,/window\.addEventListener\('online',\(\)=>\{void passivePunchRefresh\(\)\}\)/);
 assert.match(block,/document\.addEventListener\('visibilitychange'/);
 assert.match(block,/setInterval\(\(\)=>\{void passivePunchRefresh\(\)\},30000\)/);
 assert.doesNotMatch(block,/window\.addEventListener\('online',\(\)=>\{if\(member\(\)\)reload/);
});
