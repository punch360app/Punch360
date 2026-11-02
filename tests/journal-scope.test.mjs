import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PunchJournal,projectPendingPunches} from '../web/live/journal.js';

const own={id:'own-session',company_id:'tenant-A',user_id:'employee-A',
 started_at:'2026-11-01T10:00:00Z',ended_at:null};
const foreign={id:'foreign-session',company_id:'tenant-B',user_id:'employee-B',
 started_at:'2026-11-01T09:00:00Z',ended_at:null};
const base={sessions:[foreign,own],segments:[
 {id:'other-segment',company_id:'tenant-B',session_id:foreign.id,job_id:'foreign-site',started_at:foreign.started_at,ended_at:null},
 {id:'own-segment',company_id:'tenant-A',session_id:own.id,job_id:'my-site',started_at:own.started_at,ended_at:null}
],breaks:[]};
const event=(action,id,job=null)=>({
 id,company:'tenant-A',user:'employee-A',action,job,
 occurredAt:'2026-11-01T12:00:00Z',status:'pending'
});

test('offline OUT must close only its company and employee session',()=>{
 const view=projectPendingPunches(base,[event('out','ev-out')]);
 assert.equal(view.sessions.find(s=>s.id===own.id).ended_at,'2026-11-01T12:00:00Z');
 assert.equal(view.sessions.find(s=>s.id===foreign.id).ended_at,null);
 assert.equal(view.segments.find(s=>s.id==='own-segment').ended_at,'2026-11-01T12:00:00Z');
 assert.equal(view.segments.find(s=>s.id==='other-segment').ended_at,null);
});
test('offline transfer may not move another worker or company segment',()=>{
 const view=projectPendingPunches(base,[event('transfer','ev-move','new-site')]);
 assert.equal(view.segments.find(s=>s.id==='own-segment').ended_at,'2026-11-01T12:00:00Z');
 assert.equal(view.segments.find(s=>s.id==='other-segment').ended_at,null);
 assert.equal(view.segments.find(s=>s.id==='local-ev-move').session_id,own.id);
});
test('offline IN creates a local own session despite a foreign open session',()=>{
 const snapshot={sessions:[foreign],segments:[base.segments[0]],breaks:[]};
 const view=projectPendingPunches(snapshot,[event('in','ev-in','my-site')]);
 assert.equal(view.sessions.length,2);
 assert.equal(view.active.company_id,'tenant-A');
 assert.equal(view.active.user_id,'employee-A');
 assert.equal(view.sessions.find(s=>s.id===foreign.id).ended_at,null);
});
test('offline breaks never attach to another worker and preserve own active session',()=>{
 const view=projectPendingPunches(base,[event('break_start','ev-break')]);
 assert.equal(view.breaks.find(b=>b.id==='local-ev-break').session_id,own.id);
 const foreignOnly=projectPendingPunches({sessions:[foreign],segments:[],breaks:[]},
  [event('break_start','ev-break')]);
 assert.equal(foreignOnly.breaks.length,0);
});
test('a newly created offline punch marks offline before the first send, including an empty journal',async()=>{
 const memory=new Map();let calls=0;
 const j=new PunchJournal({company:'tenant-A',user:'employee-A',
  uuid:()=>String(++calls),storage:{
   get:async k=>memory.get(k)||null,
   set:async(k,v)=>memory.set(k,v)
  },send:async()=>({sync_status:'synced'})});
 await j.append('in','my-site',null,'2026-11-01T10:00:00Z',false,true);
 assert.equal((await j.read())[0].offline,true);
 await j.flush();
 assert.equal((await j.read())[0].offline,true);
});

test('web punch selectors and journal append are scoped to authenticated identity',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/function currentSession\(\)\{const c=company\(\),u=state\.user\?\.id/);
 assert.match(app,/state\.sessions\.find\(s=>s\.company_id===c&&s\.user_id===u&&!s\.ended_at\)/);
 assert.match(app,/state\.segments\.find\(s=>s\.company_id===company\(\)&&s\.session_id===active\.id&&!s\.ended_at\)/);
 assert.match(app,/journal\.append\(action,job,fix,at,paid,!navigator\.onLine\)/);
});

test('an offline event cannot inherit another company last selected job',()=>{
 const projected=projectPendingPunches(base,[event('out','ev-last')]);
 assert.equal(projected.lastJobId,'my-site');
});

test('same session ID in a contaminated cache cannot close foreign breaks or segments',()=>{
 const foreignSegment={id:'foreign-collision',session_id:own.id,company_id:'tenant-B',
  job_id:'foreign-site',started_at:'2026-11-01T11:00:00Z',ended_at:null};
 const foreignPause={id:'foreign-break',session_id:own.id,company_id:'tenant-B',
  user_id:'employee-B',started_at:'2026-11-01T11:30:00Z',ended_at:null,is_paid:false};
 const snapshot={sessions:base.sessions,
  segments:[foreignSegment,...base.segments],breaks:[foreignPause]};
 const projected=projectPendingPunches(snapshot,[event('out','ev-out')]);
 assert.equal(projected.segments.find(x=>x.id==='foreign-collision').ended_at,null);
 assert.equal(projected.breaks.find(x=>x.id==='foreign-break').ended_at,null);
 assert.equal(projected.segments.find(x=>x.id==='own-segment').ended_at,'2026-11-01T12:00:00Z');
});

test('a stale mixed snapshot without pending events cannot select another tenant or worker',()=>{
 const scoped=projectPendingPunches(base,[],{company:'tenant-A',user:'employee-A'});
 assert.equal(scoped.active?.id,'own-session');
 assert.equal(scoped.lastJobId,'my-site');
 const empty=projectPendingPunches({sessions:[foreign],segments:[base.segments[0]],breaks:[]},[],
  {company:'tenant-A',user:'employee-A'});
 assert.equal(empty.active,null);
 assert.equal(empty.lastJobId,null);
});
test('only matching pending events are projected when explicit user/company scope is provided',()=>{
 const foreignEvent={...event('out','foreign-out'),company:'tenant-B',user:'employee-B'};
 const scoped=projectPendingPunches(base,[foreignEvent],{company:'tenant-A',user:'employee-A'});
 assert.equal(scoped.sessions.find(s=>s.id===foreign.id).ended_at,null);
 assert.equal(scoped.sessions.find(s=>s.id===own.id).ended_at,null);
 assert.equal(scoped.active?.id,'own-session');
 const ownOut=projectPendingPunches(base,[foreignEvent,event('out','own-out')],{company:'tenant-A',user:'employee-A'});
 assert.equal(ownOut.sessions.find(s=>s.id===own.id).ended_at,'2026-11-01T12:00:00Z');
 assert.equal(ownOut.sessions.find(s=>s.id===foreign.id).ended_at,null);
});
test('Web and Expo always supply the worker/company to the shared overlay',()=>{
 const web=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const native=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
 assert.equal(web.split('projectPendingPunches(state.serverPunch,events,{company:companyId,user:userId})').length-1,2);
 assert.match(native,/projectPendingPunches\(own,journalBlocked\?\[\]:events,\{company:companyId,user:user\.id\}\)/);
 assert.match(native,/const ownSessions=\(state\.sessions\|\|\[\]\)\.filter\(s=>s\.company_id===companyId&&s\.user_id===user\.id\)/);
});


test('scoped projections ignore legacy sessions with no verified owner',()=>{
 const anonymous={id:'legacy',company_id:null,user_id:null,started_at:'2026-11-01T08:00:00Z',ended_at:null};
 const old={sessions:[anonymous],segments:[
  {id:'old-segment',company_id:null,session_id:'legacy',job_id:'uncertain',ended_at:null}
 ],breaks:[]};
 const scope={company:'tenant-A',user:'employee-A'};
 const out=projectPendingPunches(old,[event('out','out-legacy')],scope);
 assert.equal(out.sessions[0].ended_at,null,'Unverified session must not be closed');
 assert.equal(out.active,null,'Unverified session must not be shown as the employee session');
 assert.equal(out.lastJobId,null,'Unverified workplace must not be selected');
 const newIn=projectPendingPunches(old,[event('in','in-safe','my-site')],scope);
 assert.equal(newIn.sessions.find(s=>s.id==='legacy').ended_at,null);
 assert.equal(newIn.active?.id,'local-in-safe');
 assert.equal(newIn.active?.company_id,'tenant-A');
 assert.equal(newIn.active?.user_id,'employee-A');
 // Unscoped legacy callers keep their historic behavior.
 assert.equal(projectPendingPunches(old,[event('out','old-unscoped')]).sessions[0].ended_at,
  '2026-11-01T12:00:00Z');
});

test('scoped OUT does not change segments or breaks with missing ownership',()=>{
 const session={...own};
 const old={sessions:[session],segments:[
  {id:'unknown-company',company_id:null,session_id:session.id,job_id:'unknown-job',ended_at:null},
  {id:'own-segment',company_id:'tenant-A',session_id:session.id,job_id:'my-site',ended_at:null}
 ],breaks:[
  {id:'unknown-break',company_id:null,user_id:'employee-A',session_id:session.id,ended_at:null},
  {id:'my-break',company_id:'tenant-A',user_id:'employee-A',session_id:session.id,ended_at:null}
 ]};
 const result=projectPendingPunches(old,[event('out','safe')],{company:'tenant-A',user:'employee-A'});
 assert.equal(result.segments.find(s=>s.id==='unknown-company').ended_at,null);
 assert.equal(result.breaks.find(b=>b.id==='unknown-break').ended_at,null);
 assert.equal(result.segments.find(s=>s.id==='own-segment').ended_at,'2026-11-01T12:00:00Z');
 assert.equal(result.breaks.find(b=>b.id==='my-break').ended_at,'2026-11-01T12:00:00Z');
});

test('last offline workplace ignores a segment owned by another worker even if session ID collides',()=>{
 const snapshot={sessions:[own],segments:[
  {id:'wrong-worker',company_id:'tenant-A',user_id:'employee-B',session_id:own.id,job_id:'other-job'},
  {id:'own-job',company_id:'tenant-A',session_id:own.id,job_id:'my-site'}
 ],breaks:[]};
 assert.equal(projectPendingPunches(snapshot,[],{company:'tenant-A',user:'employee-A'}).lastJobId,'my-site');
});

test('invalid journal entries are retained for recovery but not projected into attendance',()=>{
 const result=projectPendingPunches({sessions:[],segments:[],breaks:[]},[
  null,{status:'pending'}, {id:'invalid',status:'pending',company:'tenant-A',user:null},
  event('in','valid-in','my-site')
 ],{company:'tenant-A',user:'employee-A'});
 assert.equal(result.sessions.length,1);
 assert.equal(result.active?.id,'local-valid-in');
 assert.equal(projectPendingPunches({sessions:[],segments:[],breaks:[]},[null,{}],
  {company:'tenant-A',user:'employee-A'}).active,null);
});

test('malformed legacy IN never creates a phantom session or unassigned projected hours',()=>{
 const identity={company:'tenant-A',user:'employee-A'};
 for(const job of [null,undefined,'','   ',42]){
  const bad={...event('in','orphan',job)};
  const projected=projectPendingPunches({sessions:[],segments:[],breaks:[]},[bad],identity);
  assert.equal(projected.active,null);
  assert.deepEqual(projected.sessions,[]);
  assert.deepEqual(projected.segments,[]);
  assert.equal(projected.lastJobId,null);
 }
});

test('malformed legacy transfer cannot close the valid active segment or select another workplace',()=>{
 const identity={company:'tenant-A',user:'employee-A'};
 for(const job of [null,undefined,'  ',42]){
  const bad={...event('transfer','orphan-transfer',job)};
  const projected=projectPendingPunches(base,[bad],identity);
  assert.equal(projected.active?.id,own.id);
  assert.equal(projected.segments.find(s=>s.id==='own-segment').ended_at,null);
  assert.equal(projected.segments.some(s=>s.id==='local-orphan-transfer'),false);
  assert.equal(projected.lastJobId,'my-site');
 }
});

test('a clock-skewed OUT cannot erase a valid active shift before its start',()=>{
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[]};
 const skewed={...event('out','early-out'),occurredAt:'2026-11-01T09:00:00Z'};
 const result=projectPendingPunches(snapshot,[skewed],{company:'tenant-A',user:'employee-A'});
 assert.equal(result.active?.id,own.id);
 assert.equal(result.sessions[0].ended_at,null);
 assert.equal(result.segments[0].ended_at,null);
});

test('a late offline OUT and transfer cannot close a job segment before it started',()=>{
 const job={...base.segments[1],started_at:'2026-11-01T11:30:00Z'};
 const snapshot={sessions:[own],segments:[job],breaks:[]};
 for(const action of ['out','transfer']){
  const stale={...event(action,'skewed-action','later-job'),occurredAt:'2026-11-01T11:00:00Z'};
  const result=projectPendingPunches(snapshot,[stale],{company:'tenant-A',user:'employee-A'});
  assert.equal(result.active?.id,own.id,action);
  assert.equal(result.segments.find(s=>s.id===job.id).ended_at,null,action);
  assert.equal(result.segments.some(s=>s.id==='local-skewed-action'),false,action);
  assert.equal(result.lastJobId,'my-site',action);
 }
});

test('a clock-skewed break end or OUT cannot close a pause before its beginning',()=>{
 const pause={id:'pause',company_id:'tenant-A',user_id:'employee-A',session_id:own.id,
  started_at:'2026-11-01T11:50:00Z',ended_at:null,is_paid:false};
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[pause]};
 for(const action of ['break_end','out']){
  const old={...event(action,'early-break-end'),occurredAt:'2026-11-01T11:10:00Z'};
  const result=projectPendingPunches(snapshot,[old],{company:'tenant-A',user:'employee-A'});
  assert.equal(result.breaks[0].ended_at,null,action);
  assert.equal(result.active?.id,own.id,action);
  assert.equal(result.segments[0].ended_at,null,action);
 }
});

test('a break start earlier than its active session is not projected',()=>{
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[]};
 const old={...event('break_start','skewed-pause'),occurredAt:'2026-11-01T09:59:00Z'};
 const result=projectPendingPunches(snapshot,[old],{company:'tenant-A',user:'employee-A'});
 assert.deepEqual(result.breaks,[]);
 assert.equal(result.active?.id,own.id);
});

test('chronological shift, pause and OUT continue to project normally at exact boundaries',()=>{
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[]};
 const events=[
  {...event('break_start','pause-start'),occurredAt:'2026-11-01T10:00:00Z'},
  {...event('break_end','pause-end'),occurredAt:'2026-11-01T10:30:00Z'},
  {...event('out','end-shift'),occurredAt:'2026-11-01T12:00:00Z'}
 ];
 const result=projectPendingPunches(snapshot,events,{company:'tenant-A',user:'employee-A'});
 assert.equal(result.active,null);
 assert.equal(result.sessions[0].ended_at,'2026-11-01T12:00:00Z');
 assert.equal(result.segments[0].ended_at,'2026-11-01T12:00:00Z');
 assert.equal(result.breaks[0].started_at,'2026-11-01T10:00:00Z');
 assert.equal(result.breaks[0].ended_at,'2026-11-01T10:30:00Z');
});

test('a clock-skewed OUT cannot close a shift before a previously completed pause',()=>{
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[
  {id:'completed-pause',company_id:'tenant-A',user_id:'employee-A',session_id:own.id,
   started_at:'2026-11-01T10:45:00Z',ended_at:'2026-11-01T11:15:00Z',is_paid:false}
 ]};
 const out={...event('out','backdated-out'),occurredAt:'2026-11-01T10:30:00Z'};
 const result=projectPendingPunches(snapshot,[out],{company:'tenant-A',user:'employee-A'});
 assert.equal(result.active?.id,own.id);
 assert.equal(result.sessions[0].ended_at,null);
 assert.equal(result.segments[0].ended_at,null);
 assert.equal(result.breaks[0].ended_at,'2026-11-01T11:15:00Z');
});

test('backdated transfer and break start cannot predate an already closed pause',()=>{
 const snapshot={sessions:[own],segments:[base.segments[1]],breaks:[
  {id:'completed-pause',company_id:'tenant-A',user_id:'employee-A',session_id:own.id,
   started_at:'2026-11-01T10:30:00Z',ended_at:'2026-11-01T11:00:00Z'}
 ]};
 for(const action of ['transfer','break_start']){
  const old={...event(action,'clock-rollback','new-site'),occurredAt:'2026-11-01T10:45:00Z'};
  const projected=projectPendingPunches(snapshot,[old],{company:'tenant-A',user:'employee-A'});
  assert.equal(projected.segments.find(s=>s.id==='own-segment').ended_at,null,action);
  assert.equal(projected.segments.some(s=>s.id==='local-clock-rollback'),false,action);
  assert.equal(projected.breaks.length,1,action);
  assert.equal(projected.active?.id,own.id,action);
 }
});

test('a new break cannot predate the end of an earlier job segment',()=>{
 const snapshot={sessions:[own],segments:[
  {...base.segments[1],ended_at:'2026-11-01T11:00:00Z'},
  {id:'next-job',company_id:'tenant-A',session_id:own.id,job_id:'next-site',
   started_at:'2026-11-01T11:00:00Z',ended_at:null}
 ],breaks:[]};
 const old={...event('break_start','early-break'),occurredAt:'2026-11-01T10:45:00Z'};
 const projected=projectPendingPunches(snapshot,[old],{company:'tenant-A',user:'employee-A'});
 assert.deepEqual(projected.breaks,[]);
 assert.equal(projected.active?.id,own.id);
 assert.equal(projected.segments.find(s=>s.id==='next-job').ended_at,null);
});

test('a fresh OUT after completed pauses and transfers still closes the shift',()=>{
 const snapshot={sessions:[own],segments:[
  {...base.segments[1],ended_at:'2026-11-01T11:00:00Z'},
  {id:'later',company_id:'tenant-A',session_id:own.id,job_id:'later-site',
   started_at:'2026-11-01T11:00:00Z',ended_at:null}
 ],breaks:[{id:'closed',company_id:'tenant-A',user_id:'employee-A',session_id:own.id,
  started_at:'2026-11-01T10:00:00Z',ended_at:'2026-11-01T10:30:00Z'}]};
 const out={...event('out','valid-out'),occurredAt:'2026-11-01T12:00:00Z'};
 const result=projectPendingPunches(snapshot,[out],{company:'tenant-A',user:'employee-A'});
 assert.equal(result.active,null);
 assert.equal(result.sessions[0].ended_at,'2026-11-01T12:00:00Z');
 assert.equal(result.segments.find(s=>s.id==='later').ended_at,'2026-11-01T12:00:00Z');
 assert.equal(result.breaks[0].ended_at,'2026-11-01T10:30:00Z');
});
