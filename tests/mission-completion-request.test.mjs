import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionCompletionRequestKey,reserveMissionCompletionRequest,acknowledgeMissionCompletionRequest} from '../web/live/mission-completion-request.js';
const U='123e4567-e89b-42d3-a456-426614174000',V='123e4567-e89b-42d3-a456-426614174001';
const identity={user:'user-A',company:'company-A',worker:'worker-A',mission:'mission-A',version:2};
const createStorage=()=>{
 const data=new Map();
 return {data,async getItem(key){return data.has(key)?data.get(key):null},
  async setItem(key,value){data.set(key,value)},async removeItem(key){data.delete(key)}};
};
test('retry after restart uses exactly the same server idempotency key',async()=>{
 const storage=createStorage(),options={storage,identity,uuid:()=>U,now:()=>1000000};
 const first=await reserveMissionCompletionRequest(options);
 assert.equal(first.id,U);assert.equal(first.reused,false);
 const second=await reserveMissionCompletionRequest({...options,uuid:()=>{throw Error('should not regenerate')}});
 assert.equal(second.id,U);assert.equal(second.reused,true);
 assert.equal(storage.data.size,1);
 assert.equal(await acknowledgeMissionCompletionRequest(storage,second,()=>1000002),true);
 assert.equal(storage.data.size,0);
 const third=await reserveMissionCompletionRequest({...options,uuid:()=>V});
 assert.equal(third.id,V);assert.equal(third.reused,false);
});
test('company, user, worker, mission and published version isolate requests',()=>{
 const key=missionCompletionRequestKey(identity);
 for(const field of ['company','user','worker','mission','version']){
  const next={...identity,[field]:field==='version'?3:identity[field]+'-other'};
  assert.notEqual(missionCompletionRequestKey(next),key,field);
 }
 assert.throws(()=>missionCompletionRequestKey({...identity,user:'../../escape'}));
 assert.throws(()=>missionCompletionRequestKey({...identity,version:0}));
});
test('corrupted/expired records stop replay without silently replacing the id',async()=>{
 const storage=createStorage(),key=missionCompletionRequestKey(identity);
 storage.data.set(key,'{not-valid');
 await assert.rejects(reserveMissionCompletionRequest({storage,identity,uuid:()=>V,now:()=>1000000}),/illisible/);
 assert.equal(storage.data.get(key),'{not-valid');
 storage.data.set(key,JSON.stringify({id:U,createdAt:1}));
 await assert.rejects(reserveMissionCompletionRequest({storage,identity,uuid:()=>V,now:()=>32*86400000}),/expirée/);
 assert.equal(JSON.parse(storage.data.get(key)).id,U);
});
test('storage outage and silent failed writes block official completion requests',async()=>{
 const broken={async getItem(){throw Error('disk unavailable')},async setItem(){}};
 await assert.rejects(reserveMissionCompletionRequest({storage:broken,identity,uuid:()=>U}),/disk unavailable/);
 const silent={async getItem(){return null},async setItem(){}};
 await assert.rejects(reserveMissionCompletionRequest({storage:silent,identity,uuid:()=>U}),/non confirmée/);
});
test('cannot purge a different pending request',async()=>{
 const storage=createStorage(),key=missionCompletionRequestKey(identity);
 storage.data.set(key,JSON.stringify({id:U,createdAt:1000000}));
 await assert.rejects(acknowledgeMissionCompletionRequest(storage,{key,id:V},()=>1000000),/modifiée/);
 assert.equal(storage.data.size,1);
});
test('no auto sync, proof data or cross-workspace fields enter the journal',async()=>{
 const storage=createStorage();
 const request=await reserveMissionCompletionRequest({storage,identity,uuid:()=>U,now:()=>1000000});
 const raw=storage.data.get(request.key);
 for(const forbidden of ['photo','comment','address','latitude','client','GPS','password'])
  assert.equal(raw.includes(forbidden),false,forbidden);
 assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['createdAt','id']);
});
