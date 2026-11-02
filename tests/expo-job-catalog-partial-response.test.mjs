import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/jobs/api.ts',import.meta.url),'utf8');
const start=source.indexOf('export type JobLoad=');
const end=source.indexOf('export async function createJob(',start);
assert.ok(start>=0&&end>start,'Expo jobs cache and fetch functions are required');
const body=source.slice(start,end).replace(/^export /gm,'');
const js=ts.transpileModule(body,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None
}}).outputText;
const site={id:'job-1',company_id:'tenant-A',number:'JOB-001',name:'Bureau',
 address:'1, rue Test',latitude:null,longitude:null,photo_url:null,active:true};
const existing={jobs:[{...site,assigned_to_me:true,planned_start:null}],
 demo:false,message:'',readSource:'server'};
function fixture({state='online',cache=existing,override={},error={}}={}){
 let network=state,writes=0,reads=0;
 const memory=new Map();
 const key='punch-jobs:worker-A:tenant-A';
 if(cache!==null)memory.set(key,JSON.stringify(cache));
 const AsyncStorage={getItem:async k=>memory.get(k)||null,
  setItem:async(k,v)=>{writes++;memory.set(k,v)}};
 const calls=[];
 const tables={
  jobs:[site],
  job_assignments:[{job_id:'job-1',planned_start:null}],
  scheduled_shifts:[]
 };
 const supabase={from:name=>{
  calls.push(name);
  const query={select:()=>query,eq:()=>query,order:()=>query,
   is:()=>query,gt:()=>query,
   then:(done,fail)=>Promise.resolve({
    data:Object.prototype.hasOwnProperty.call(override,name)?override[name]:tables[name],
    error:error[name]||null
   }).then(done,fail)};
  return query;
 }};
 const Network={getNetworkStateAsync:async()=>{
  if(network==='throws')throw Error('Network probe unavailable');
  if(network==='unknown')return {isConnected:true,isInternetReachable:null};
  return {isConnected:network==='online',isInternetReachable:network==='online'};
 }};
 const getLocalIdentity=async()=>({id:'worker-A'});
 const {listMyCompanyJobs,scopedJobCache}=new Function('Network','getLocalIdentity',
  'AsyncStorage','supabase',js+'\nreturn {listMyCompanyJobs,scopedJobCache};')(
  Network,getLocalIdentity,AsyncStorage,supabase);
 return {load:()=>listMyCompanyJobs('tenant-A'),scopedJobCache,memory,key,calls,
  get writes(){return writes},get reads(){return reads},
  setState:value=>{network=value}};
}

test('verified jobs, assignments and shifts are saved together as a complete catalogue',async()=>{
 const date='2030-11-04T10:00:00Z';
 const f=fixture({cache:null,override:{scheduled_shifts:[{job_id:'job-1',starts_at:date}]}});
 const state=await f.load();
 assert.equal(state.readSource,'server');
 assert.equal(state.jobs.length,1);
 assert.equal(state.jobs[0].assigned_to_me,true);
 assert.equal(state.jobs[0].planned_start,date);
 assert.deepEqual(f.calls,['jobs','job_assignments','scheduled_shifts']);
 assert.equal(f.writes,1);
 assert.equal(JSON.parse(f.memory.get(f.key)).jobs[0].planned_start,date);
 f.setState('offline');
 const cached=await f.load();
 assert.equal(cached.readSource,'cache');
 assert.equal(cached.jobs[0].planned_start,date);
 assert.equal(f.writes,1);
});

test('unknown reachability must use local catalogue without server queries or writes',async()=>{
 const f=fixture({state:'unknown'});
 const before=f.memory.get(f.key);
 const result=await f.load();
 assert.equal(result.readSource,'cache');
 assert.equal(result.jobs[0].id,'job-1');
 assert.deepEqual(f.calls,[]);
 assert.equal(f.writes,0);
 assert.equal(f.memory.get(f.key),before);
});

test('server jobs success with null array cannot erase offline job list',async()=>{
 const f=fixture({override:{jobs:null}}),before=f.memory.get(f.key);
 const result=await f.load();
 assert.equal(result.readSource,'cache');
 assert.equal(result.jobs.length,1);
 assert.equal(f.writes,0);
 assert.equal(f.memory.get(f.key),before);
 await assert.rejects(fixture({cache:null,override:{jobs:null}}).load(),/incomplet/);
});

test('failed or malformed job assignments retain previous verified personal assignments',async()=>{
 for(const overrides of [
  {override:{job_assignments:null}},
  {override:{job_assignments:[{job_id:'job-1'}]}},
  {override:{job_assignments:[{job_id:'job-1',planned_start:'bad-date'}]}},
  {error:{job_assignments:{message:'offline'}}}
 ]){
  const f=fixture(overrides),bytes=f.memory.get(f.key);
  const current=await f.load();
  assert.equal(current.readSource,'cache');
  assert.equal(current.jobs[0].assigned_to_me,true);
  assert.equal(f.memory.get(f.key),bytes);
  assert.equal(f.writes,0);
  assert.deepEqual(f.calls,['jobs','job_assignments']);
 }
});

test('failed or malformed future shifts cannot silently overwrite saved worker schedules',async()=>{
 for(const overrides of [
  {override:{scheduled_shifts:null}},
  {override:{scheduled_shifts:[{job_id:'job-1',starts_at:'not-a-date'}]}},
  {override:{scheduled_shifts:[{job_id:'job-1'}]}},
  {error:{scheduled_shifts:{message:'offline'}}}
 ]){
  const f=fixture(overrides),bytes=f.memory.get(f.key);
  const current=await f.load();
  assert.equal(current.readSource,'cache');
  assert.equal(current.jobs[0].assigned_to_me,true);
  assert.equal(f.memory.get(f.key),bytes);
  assert.equal(f.writes,0);
  assert.deepEqual(f.calls,['jobs','job_assignments','scheduled_shifts']);
 }
});

test('incomplete first fetch without a saved catalogue fails rather than claiming no jobs',async()=>{
 await assert.rejects(fixture({cache:null,override:{scheduled_shifts:null}}).load(),/Horaires incomplets/);
 await assert.rejects(fixture({cache:null,override:{job_assignments:null}}).load(),/Affectations incomplètes/);
 await assert.rejects(fixture({cache:null,override:{jobs:[{...site,active:null}]}}).load(),/Données chantiers incomplètes/);
});

test('server returns foreign tenant job: fail closed, never use or overwrite cache',async()=>{
 const f=fixture({override:{jobs:[{...site,company_id:'tenant-B'}]}}),before=f.memory.get(f.key);
 await assert.rejects(f.load(),/hors entreprise/);
 assert.equal(f.writes,0);
 assert.equal(f.memory.get(f.key),before);
});

test('malformed cached job catalogue is never accepted offline',async()=>{
 for(const jobs of [[{...site,company_id:'tenant-B'}],
  [{...site,latitude:999}],
  [{...site,number:null}]]){
  const f=fixture({state:'offline',cache:{...existing,jobs}});
  await assert.rejects(f.load(),/Chantiers hors ligne indisponibles/);
  assert.deepEqual(f.calls,[]);
  assert.equal(f.writes,0);
 }
});
