import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queueOfflineMissionCompletion,listOfflineMissionCompletions,missionOfflineEligible,syncOfflineMissionCompletions} from '../web/live/mission-offline-queue.js';
const A={user:'user-A',company:'company-A',worker:'worker-A'},B={...A,company:'company-B'};
const mission={...A,mission:'mission-1',version:3},uuid='123e4567-e89b-42d3-a456-426614174000',day='2026-10-28';
function store(){const m=new Map();return{m,async getItem(k){return m.has(k)?m.get(k):null},async setItem(k,v){m.set(k,v)},async removeItem(k){m.delete(k)},async getAllKeys(){return [...m.keys()]}}}
const args=(storage,identity=mission)=>({storage,identity,day,uuid:()=>uuid,now:()=>1000000});
const fetchData=()=>({enabled:true,truncated:false,comment_required:false,checklist_required:false,photo_required:false,
 items:[{id:'mission-1',worker_id:'worker-A',status:'published',version:3,sort_order:1}]});
function sync(storage,overrides={}){
 const spy={sends:[]};
 const options={storage,identity:A,now:()=>1000020,verifyUser:async()=>A.user,
  fetchDay:async()=>fetchData(),nextMissionId:items=>items[0]?.id,
  send:async rec=>{spy.sends.push(rec);return {status:'completed',duplicate:false}},...overrides};
 return {spy,run:()=>syncOfflineMissionCompletions(options)};
}
test('offline no-proof completion is durable, isolated and never claims server confirmation',async()=>{
 const storage=store();const first=await queueOfflineMissionCompletion(args(storage));
 const second=await queueOfflineMissionCompletion({...args(storage),uuid:()=>{throw Error('new id')}});
 assert.equal(first.id,second.id);assert.equal(first.queued,true);
 assert.equal((await listOfflineMissionCompletions({storage,identity:A,now:()=>1000000})).length,1);
 assert.equal((await listOfflineMissionCompletions({storage,identity:B,now:()=>1000000})).length,0);
 const str=[...storage.m.values()][0];
 for(const prohibited of ['photo','comment','address','client','latitude','gps','instructions'])
  assert.equal(str.toLowerCase().includes(prohibited),false);
 assert.deepEqual(Object.keys(JSON.parse(str)).sort(),['createdAt','day','id','queuedAt']);
});
test('reconnection rechecks user and server version/order/proof before single RPC',async()=>{
 const storage=store();await queueOfflineMissionCompletion(args(storage));
 const {spy,run}=sync(storage);const result=await run();
 assert.equal(spy.sends.length,1);assert.equal(spy.sends[0].request,uuid);
 assert.equal(result.sent,1);assert.equal(result.pending,0);
});
test('changed published version, policy or order keeps queue without RPC',async()=>{
 for(const alteration of [
  d=>{d.items[0].version=4},
  d=>{d.comment_required=true},
  d=>{d.photo_required=true},
  d=>{d.checklist_required=true},
  d=>{d.enabled=false},
  d=>{d.items[0].worker_id='other'},
  d=>{d.truncated=true},
  d=>{d.items[0].status='cancelled'}
 ]){
  const storage=store();await queueOfflineMissionCompletion(args(storage));
  const {spy,run}=sync(storage,{fetchDay:async()=>{const x=fetchData();alteration(x);return x}});
  const result=await run();
  assert.equal(result.sent,0);assert.equal(result.pending,1);
  assert.equal(result.conflicts.length,1);assert.equal(spy.sends.length,0);
 }
});
test('wrong account and lost network never send, never discard the pending event',async()=>{
 const storage=store();await queueOfflineMissionCompletion(args(storage));
 const mismatch=sync(storage,{verifyUser:async()=> 'different'});
 await assert.rejects(mismatch.run(),/Session différente/);
 assert.equal(mismatch.spy.sends.length,0);
 const fail=sync(storage,{send:async()=>{throw Error('offline again')}});
 const result=await fail.run();
 assert.equal(result.pending,1);assert.match(result.networkError,/conservée/);
});
test('failed local storage write does not create a phantom queued completion',async()=>{
 const storage=store();storage.setItem=async()=>{};
 await assert.rejects(queueOfflineMissionCompletion(args(storage)),/non confirmée/);
});
test('only previously verified, unambiguous, no-proof completion can be queued',()=>{
 const base={verified:true,enabled:true,mission:{status:'published',version:3}};
 assert.equal(missionOfflineEligible(base),true);
 for(const field of ['verified','enabled','commentRequired','checklistRequired','photoRequired','photoSelected','truncated','ambiguous']){
  const x={...base,[field]:field==='verified'||field==='enabled'?false:true};
  assert.equal(missionOfflineEligible(x),false,field);
 }
});
test('corrupt and expired records block replay, never overwrite them',async()=>{
 const storage=store();await queueOfflineMissionCompletion(args(storage));
 const key=[...storage.m.keys()][0],data=JSON.parse(storage.m.get(key));
 storage.m.set(key,'broken');
 await assert.rejects(listOfflineMissionCompletions({storage,identity:A}),/illisible/);
 storage.m.set(key,JSON.stringify({...data,queuedAt:1,createdAt:1}));
 await assert.rejects(listOfflineMissionCompletions({storage,identity:A,now:()=>50*86400000}),/expirée/);
});

test('lost ACK resolves ONLY if server confirms the exact same idempotency request',async()=>{
 const storage=store();await queueOfflineMissionCompletion(args(storage));
 const latest={...fetchData(),items:[{id:'mission-1',worker_id:'worker-A',
  status:'completed',version:4,sort_order:1}],photo_required:true};
 const accepted=sync(storage,{fetchDay:async()=>latest,
  nextMissionId:()=>null,send:async rec=>{
   assert.equal(rec.request,uuid);assert.equal(rec.version,3);
   return {status:'completed',duplicate:true};
  }});
 const confirmed=await accepted.run();
 assert.equal(confirmed.sent,1);assert.equal(confirmed.pending,0);
});
test('another completion or a false duplicate ACK cannot silently purge the queue',async()=>{
 const storage=store();await queueOfflineMissionCompletion(args(storage));
 const latest={...fetchData(),items:[{id:'mission-1',worker_id:'worker-A',
  status:'completed',version:4,sort_order:1}]};
 const attempt=sync(storage,{fetchDay:async()=>latest,send:async()=>({status:'completed',duplicate:false})});
 const result=await attempt.run();
 assert.equal(result.sent,0);assert.equal(result.pending,1);
 assert.match(result.networkError,/Accusé serveur invalide/);
});
