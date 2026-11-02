import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Evaluate the same native load handler against isolated storage/network mocks.
// No Supabase tenant, permissions or payroll records are modified here.
const native=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
const start=native.indexOf(' async function load(){');
const end=native.indexOf(' useEffect(()=>{setMobileAllowed(false)',start);
assert.ok(start>0&&end>start,'Native Essentials workspace load handler is required');
const source=native.slice(start,end)
 .replace('let cached:any=null;','let cached=null;')
 .replace('let channel:any;','let channel;')
 .replace('let site:any;','let site;')
 .replace('catch(e:any)','catch(e)');
function fixture({throwWorker=false,throwSite=false,workerError=false,siteError=false,
 rawCache=null,offline=false}={}){
 const calls={hours:0,journal:0,worker:0,site:0};
 const updates={mobile:[],job:[],blocked:[],hours:[],notice:[],worker:[]};
 const account={companyId:'tenant-A',userId:'employee-A',defaultJobId:'default-site'};
 const visitContext={current:'tenant-A:employee-A'};
 const punchReadRevision={current:0},punchActionInFlight={current:false},syncInFlight={current:false};
 const storage={getItem:async()=>rawCache,setItem:async()=>{}};
 const network={getNetworkStateAsync:async()=>({isConnected:!offline,isInternetReachable:!offline})};
 const db={from:table=>{
  const query={select:()=>query,eq:()=>query,async maybeSingle(){
   if(table==='company_workers'){
    calls.worker++;
    if(throwWorker)throw Error('permissions transport rejected');
    if(workerError)return {data:null,error:Error('worker error')};
    return {data:{id:'worker',status:'active',can_mobile_punch:true,personal_access:true,location_id:'location'},error:null};
   }
   if(table==='essential_locations'){
    calls.site++;
    if(throwSite)throw Error('site transport rejected');
    if(siteError)return {data:null,error:Error('location error')};
    return {data:{id:'location',company_id:'tenant-A',punch_job_id:'assigned-site',active:true,name:'Site',address:'Street'},error:null};
   }
   throw Error('Unexpected table '+table);
  }};
  return query;
 },async rpc(){return {data:{items:[],has_more:false},error:null}}};
 const setters={
  setMobileAllowed:value=>updates.mobile.push(value),
  setSiteJob:value=>updates.job.push(value),
  setPunch:value=>updates.hours.push(value),
  setJournalBlocked:value=>updates.blocked.push(value),
  setMissionWorker:value=>updates.worker.push(value),
  setNotice:value=>updates.notice.push(typeof value==='function'?value(updates.notice.at(-1)||''):value),
  setMyVisit:()=>{},setVisitUnavailable:()=>{},setFixedAddress:()=>{},
  setFixedName:()=>{},setPending:()=>{},setConflicts:()=>{},
  setPendingItems:()=>{},setConflictItems:()=>{}
 };
 const deps={punchActionInFlight,syncInFlight,account,punchReadRevision,visitContext,
  AsyncStorage:storage,Network:network,supabase:db,
  essentialWorkerPunchJobId:(_company,_worker,locations,defaultId)=>
   locations.length?locations[0].punch_job_id:
    _worker.location_id?null:defaultId,
  personalUpcomingClientVisit:()=>null,
  loadPunchState:async()=>{calls.hours++;return {sessions:[],segments:[],active:null,lastJobId:null,readSource:'server'}},
  journalSummary:async()=>{calls.journal++;return {pending:0,conflicts:0,blocked:false,pendingItems:[],conflictItems:[]}},
  ...setters};
 const load=new Function(...Object.keys(deps),source+'\nreturn load;')(...Object.values(deps));
 return {run:()=>load(),calls,updates};
}
test('a rejected worker permissions request cannot suppress the read-only hours snapshot',async()=>{
 const h=fixture({throwWorker:true});await h.run();
 assert.equal(h.calls.hours,1);
 assert.equal(h.calls.journal,1);
 assert.equal(h.calls.site,0);
 assert.deepEqual(h.updates.mobile,[false]);
 assert.deepEqual(h.updates.job,[null]);
 assert.deepEqual(h.updates.blocked,[false]);
 assert.equal(h.updates.hours.length,1);
});
test('a rejected assigned-site lookup does not grant default-job PUNCH or hide hours',async()=>{
 const h=fixture({throwSite:true});await h.run();
 assert.equal(h.calls.hours,1);
 assert.equal(h.calls.journal,1);
 assert.deepEqual(h.updates.mobile,[true],'Verified mobile channel remains distinct from site permission');
 assert.deepEqual(h.updates.job,[null],'Unknown assigned site cannot fall back to default');
 assert.deepEqual(h.updates.blocked,[false]);
});
test('query error results and thrown exceptions have equivalent safe permissions outcomes',async()=>{
 for(const [throwing,failed] of [
  [{throwWorker:true},{workerError:true}],
  [{throwSite:true},{siteError:true}]
 ]){
  const a=fixture(throwing),b=fixture(failed);
  await a.run();await b.run();
  assert.deepEqual(a.updates.mobile,b.updates.mobile);
  assert.deepEqual(a.updates.job,b.updates.job);
  assert.deepEqual(a.updates.blocked,b.updates.blocked);
  assert.equal(a.calls.hours,b.calls.hours);
 }
});
test('a cached permission is reusable only when recent and owner-scoped after worker failure',async()=>{
 const raw=JSON.stringify({version:2,allowed:true,job:'saved-site',checkedAt:Date.now()});
 const valid=fixture({throwWorker:true,rawCache:raw});await valid.run();
 assert.deepEqual(valid.updates.mobile,[true]);
 assert.deepEqual(valid.updates.job,['saved-site']);
 assert.equal(valid.calls.hours,1);
 const stale=fixture({throwWorker:true,rawCache:JSON.stringify({
  version:2,allowed:true,job:'saved-site',checkedAt:Date.now()-90000000})});
 await stale.run();
 assert.deepEqual(stale.updates.mobile,[false]);
 assert.deepEqual(stale.updates.job,[null]);
 assert.equal(stale.calls.hours,1);
});
test('a successful worker and assigned site query still gives the verified location',async()=>{
 const h=fixture();await h.run();
 assert.deepEqual(h.updates.mobile,[true]);
 assert.deepEqual(h.updates.job,['assigned-site']);
 assert.deepEqual(h.updates.blocked,[false]);
 assert.equal(h.calls.hours,1);
});
