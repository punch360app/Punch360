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
test('workspace switch during pending refresh never reports completion for old company',async()=>{
 let finish;
 const h=harness({refresh:()=>new Promise(resolve=>{finish=resolve})});
 const pending=h.retry();
 for(let i=0;i<8&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function','Server refresh must have started');
 h.setScope({companyId:'company-B'});
 finish();
 assert.equal(await pending,false);
 assert.deepEqual(h.calls,['auth','membership','refresh']);
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

test('a different company starts a new verification without inheriting the old promise',async()=>{
 const release=[];
 const h=harness({getUser:()=>new Promise(resolve=>release.push(resolve))});
 const old=h.retry();
 h.setScope({companyId:'company-B'});
 const current=h.retry();
 assert.notStrictEqual(current,old);
 assert.deepEqual(h.calls,['auth','auth']);
 release[0]('user-A');
 assert.equal(await old,false,'Old company must not report a successful sync');
 assert.strictEqual(h.retry(),current,'Old cleanup must not clear newer in-flight task');
 release[1]('user-A');
 assert.equal(await current,true);
 assert.deepEqual(h.calls,['auth','auth','membership','refresh']);
});
test('switching accounts while verification is pending verifies the new user separately',async()=>{
 const release=[];
 const h=harness({getUser:()=>new Promise(resolve=>release.push(resolve))});
 const first=h.retry();
 h.setScope({userId:'user-B'});
 const second=h.retry();
 assert.notStrictEqual(first,second);
 release[0]('user-A');
 assert.equal(await first,false);
 release[1]('user-B');
 assert.equal(await second,true);
 assert.deepEqual(h.calls,['auth','auth','membership','refresh']);
});
test('switching A to B and back never revives the first A verification',async()=>{
 const release=[];
 const h=harness({getUser:()=>new Promise(resolve=>release.push(resolve))});
 const firstA=h.retry();
 h.setScope({companyId:'company-B'});
 const forB=h.retry();
 h.setScope({companyId:'company-A'});
 const newA=h.retry();
 assert.notStrictEqual(firstA,newA);
 assert.notStrictEqual(forB,newA);
 release[0]('user-A');
 release[1]('user-A');
 assert.deepEqual(await Promise.all([firstA,forB]),[false,false]);
 release[2]('user-A');
 assert.equal(await newA,true);
 assert.deepEqual(h.calls,['auth','auth','auth','membership','refresh']);
});
test('same-workspace callbacks share the active refresh even after busy begins',async()=>{
 let finish;
 const h=harness({refresh:()=>new Promise(resolve=>{finish=resolve})});
 const task=h.retry();
 for(let i=0;i<8&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function');
 h.setBusy(true);
 assert.strictEqual(h.retry(),task);
 finish();
 assert.equal(await task,true);
 assert.deepEqual(h.calls,['auth','membership','refresh']);
});
test('busy workspace switch invalidates old verification even after returning to its identity',async()=>{
 const release=[];
 const h=harness({getUser:()=>new Promise(resolve=>release.push(resolve))});
 const old=h.retry();
 h.setScope({companyId:'company-B'});
 h.setBusy(true);
 assert.equal(await h.retry(),false,'Busy B must not run a second refresh');
 h.setScope({companyId:'company-A'});
 h.setBusy(false);
 release[0]('user-A');
 assert.equal(await old,false,'A verification interrupted by B cannot be revived');
 const fresh=h.retry();
 assert.notStrictEqual(fresh,old,'Return to A must recheck authorization');
 release[1]('user-A');
 assert.equal(await fresh,true);
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
