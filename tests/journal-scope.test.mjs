import test from 'node:test';
import assert from 'node:assert/strict';
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
