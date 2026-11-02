import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const from=app.indexOf('function scopedOfflinePunchSnapshot('),to=app.indexOf('async function locatedPunch(',from);
assert.ok(from>0&&to>from);
const source=app.slice(from,to);
const sourceSnapshot=()=>({
 company:'A',userId:'U',serverPunchCompany:'A',serverPunchFetchedAt:Date.now()-1000,
 jobs:[{id:'J',company_id:'A'}],assignments:[{job_id:'J'}],shifts:[],
 serverPunch:{
  sessions:[{id:'S',company_id:'A',user_id:'U',started_at:'2026-11-02T08:00:00Z',ended_at:'2026-11-02T12:00:00Z'}],
  segments:[{id:'G',company_id:'A',session_id:'S',job_id:'J',started_at:'2026-11-02T08:00:00Z',ended_at:'2026-11-02T12:00:00Z'}],
  breaks:[{id:'B',company_id:'A',user_id:'U',session_id:'S',started_at:'2026-11-02T09:00:00Z',ended_at:'2026-11-02T09:15:00Z'}]
 },selected:'J'
});
const storage=(raw=null)=>{
 const memory=new Map();if(raw!==null)memory.set('punch-snapshot:U:A',raw);
 return {memory,getItem:k=>memory.has(k)?memory.get(k):null,setItem:(k,v)=>memory.set(k,v)};
};
function fixture(raw=null){
 const state={user:{id:'U'},account:{company_id:'A'},jobs:[],assignments:[],shifts:[],
  sessions:[{id:'previous'}],segments:[],breaks:[],serverPunch:{sessions:[],segments:[],breaks:[]},
  serverPunchCompany:null,serverPunchFetchedAt:null,selected:null};
 const store=storage(raw),create=new Function('state','company','member','localStorage',
  source+'\nreturn {scopedOfflinePunchSnapshot,saveOfflineSnapshot,restoreOfflineSnapshot,readScopedOfflineSnapshot};');
 const api=create(state,()=>state.account?.company_id,()=>!!state.account&&!!state.user,store);
 return {state,store,...api};
}
test('valid scoped snapshot is restored without granting payroll approval',()=>{
 const h=fixture(JSON.stringify(sourceSnapshot()));
 assert.equal(h.restoreOfflineSnapshot(),true);
 assert.deepEqual(h.state.sessions.map(x=>x.id),['S']);
 assert.deepEqual(h.state.breaks.map(x=>x.id),['B']);
 assert.equal(h.state.serverPunchCompany,'A');
 assert.equal(h.state.selected,'J');
});
test('corrupt cached JSON never crashes startup or destroys original bytes',()=>{
 const broken='{"company":"A","serverPunch":',h=fixture(broken);
 assert.equal(h.restoreOfflineSnapshot(),false);
 assert.deepEqual(h.state.sessions,[{id:'previous'}]);
 assert.equal(h.store.getItem('punch-snapshot:U:A'),broken);
 assert.equal(h.saveOfflineSnapshot(),false);
 assert.equal(h.store.getItem('punch-snapshot:U:A'),broken);
});
test('mixed-tenant, mixed-user, orphaned or duplicate cache records are quarantined',()=>{
 const changes=[
  v=>v.serverPunch.sessions[0].user_id='someone-else',
  v=>v.serverPunch.segments[0].company_id='B',
  v=>v.serverPunch.breaks[0].user_id='someone-else',
  v=>v.serverPunch.sessions.push({...v.serverPunch.sessions[0]}),
  v=>v.serverPunch.segments.push({...v.serverPunch.segments[0]}),
  v=>v.serverPunch.breaks.push({...v.serverPunch.breaks[0]}),
  v=>v.jobs[0].company_id='B',
  v=>v.assignments[0].job_id='not-a-job'
 ];
 for(const change of changes){const s=sourceSnapshot();change(s);
  const raw=JSON.stringify(s),h=fixture(raw);
  assert.equal(h.restoreOfflineSnapshot(),false);
  assert.deepEqual(h.state.sessions,[{id:'previous'}]);
  assert.equal(h.store.getItem('punch-snapshot:U:A'),raw);
 }
});
test('time ranges and invalid server-read timestamps cannot manufacture trusted hours',()=>{
 const changes=[v=>v.serverPunch.sessions[0].started_at='bad-date',
  v=>v.serverPunch.segments[0].ended_at='2026-11-02T06:00:00Z',
  v=>v.serverPunch.breaks[0].started_at='not-a-date'];
 for(const change of changes){const s=sourceSnapshot();change(s);
  assert.equal(fixture().scopedOfflinePunchSnapshot(s,'A','U'),null);
 }
 const future=sourceSnapshot();future.serverPunchFetchedAt=Date.now()+1800000;
 const snapshot=fixture().scopedOfflinePunchSnapshot(future,'A','U');
 assert.equal(snapshot.serverPunchFetchedAt,null);
 assert.equal(snapshot.serverPunchCompany,null);
});
test('legacy cache missing user marker remains usable only with own attendance',()=>{
 const original=sourceSnapshot();delete original.userId;
 const h=fixture(JSON.stringify(original));assert.equal(h.restoreOfflineSnapshot(),true);
 original.serverPunch.sessions[0].user_id='other';
 assert.equal(fixture(JSON.stringify(original)).restoreOfflineSnapshot(),false);
});
test('offline cache save stamps the current user and cannot keep a foreign selected job',()=>{
 const h=fixture();const source=sourceSnapshot();
 Object.assign(h.state,{jobs:source.jobs,assignments:source.assignments,shifts:source.shifts,
  serverPunch:source.serverPunch,serverPunchCompany:'A',serverPunchFetchedAt:Date.now()-1000,
  selected:'foreign-job'});
 assert.equal(h.saveOfflineSnapshot(),true);
 const result=JSON.parse(h.store.getItem('punch-snapshot:U:A'));
 assert.equal(result.userId,'U');assert.equal(result.selected,null);
 assert.equal(h.restoreOfflineSnapshot(),true);
 assert.equal(h.state.selected,null);
});
test('failures in browser storage are handled without clearing an existing journal',()=>{
 const h=fixture();h.store.getItem=()=>{throw Error('storage denied')};
 assert.equal(h.restoreOfflineSnapshot(),false);assert.equal(h.saveOfflineSnapshot(),false);
});
test('source code reads and saves only through scoped validation',()=>{
 assert.match(source,/scopedOfflinePunchSnapshot/);
 assert.match(source,/readScopedOfflineSnapshot/);
 assert.doesNotMatch(source,/function restoreOfflineSnapshot\(\)[^{]*\{[^}]*JSON\.parse/);
 assert.match(app,/restoreOfflineSnapshot\(\);if\(isEssential\(\)\)/);
});
