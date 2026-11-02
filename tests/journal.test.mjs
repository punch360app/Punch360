import test from 'node:test';
import assert from 'node:assert/strict';
import {PunchJournal,projectPendingPunches} from '../web/live/journal.js';
function fixture(send){const memory=new Map();let id=0;return {memory,journal:new PunchJournal({company:'c',user:'u',uuid:()=>String(++id),storage:{get:async k=>memory.get(k)||null,set:async(k,v)=>memory.set(k,v)},send})};}
test('persist before network; failed network survives restart and replays in order',async()=>{
 let online=false;const received=[];const {journal,memory}=fixture(async e=>{assert.ok([...memory.values()][0].includes(e.id));if(!online)throw Error('offline');received.push(e.action);return {sync_status:'synced'}});
 await journal.append('in','A',null,'2026-10-24T11:00:00Z');await journal.flush();await journal.append('transfer','B',null,'2026-10-24T12:00:00Z');await journal.append('out',null,null,'2026-10-24T13:00:00Z');
 const local=projectPendingPunches({sessions:[],segments:[]},await journal.read());assert.equal(local.active,null);assert.equal(local.segments.length,2);assert.equal(local.sessions[0].ended_at,'2026-10-24T13:00:00Z');
 online=true;const restarted=new PunchJournal({company:'c',user:'u',uuid:()=>'',storage:journal.storage,send:journal.send});const result=await restarted.flush();assert.equal(result.pending,0);assert.deepEqual(received,['in','transfer','out']);assert.ok(result.events.every(e=>e.offline));assert.equal(result.events[1].previous,'1');
});
test('offline inspection reads pending punches without sending or rewriting saved bytes',async()=>{
 const memory=new Map();let writes=0,sends=0;
 const storage={get:async key=>memory.get(key)||null,set:async(key,value)=>{writes++;memory.set(key,value)}};
 const journal=new PunchJournal({company:'c',user:'u',uuid:()=> 'offline-1',storage,
  send:async()=>{sends++;return {sync_status:'synced'}}});
 await journal.append('in','A',null,'2026-11-02T08:00:00Z',false,true);
 const key=journal.key,before=memory.get(key),writeCount=writes;
 const inspection=await journal.inspect();
 assert.deepEqual({sent:inspection.sent,pending:inspection.pending}, {sent:0,pending:1});
 assert.equal(inspection.events[0].status,'pending');
 assert.equal(sends,0);assert.equal(writes,writeCount);
 assert.equal(memory.get(key),before,'Offline inspection must not change durable bytes');
 const synced=await journal.flush();
 assert.equal(synced.pending,0);assert.equal(sends,1);
 assert.equal((await journal.read())[0].id,'offline-1');
});

test('offline inspection refuses a damaged journal without uploading or deleting it',async()=>{
 const memory=new Map(),original=JSON.stringify([{id:'evt',company:'other',user:'u',action:'in',
  job:'A',occurredAt:'2026-11-02T08:00:00Z',status:'pending'}]);
 let sends=0,writes=0;
 const journal=new PunchJournal({company:'c',user:'u',uuid:()=> 'new-id',
  storage:{get:async key=>memory.get(key)||null,set:async(key,value)=>{writes++;memory.set(key,value)}},
  send:async()=>{sends++;return {sync_status:'synced'}}});
 memory.set(journal.key,original);
 await assert.rejects(journal.inspect(),/non vérifiable/);
 assert.equal(sends,0);assert.equal(writes,0);
 assert.equal(memory.get(journal.key),original);
});

test('concurrent append and flush cannot drop an event',async()=>{const {journal}=fixture(async()=>({sync_status:'synced'}));await Promise.all([journal.append('in','A'),journal.append('transfer','B'),journal.append('out')]);await Promise.all([journal.flush(),journal.flush()]);assert.equal((await journal.read()).length,3);assert.equal((await journal.pending()).length,0);});
test('lost response preserves immutable event id and payload for idempotent retry',async()=>{let calls=0;const ids=[];const {journal}=fixture(async e=>{ids.push(e.id);if(!calls++)throw Error('response lost');return {sync_status:'synced'}});await journal.append('in','A');await journal.flush();await journal.flush();assert.deepEqual(ids,['1','1']);assert.equal((await journal.read())[0].status,'synced');});
test('all dependent conflicts reach admin while remaining durably stored locally',async()=>{const {journal}=fixture(async()=>({sync_status:'conflict',message:'review'}));await journal.append('in','A');await journal.append('out');await journal.flush();assert.equal((await journal.read()).filter(e=>e.status==='conflict').length,2);});
test('separate worker and company journals never share queues',async()=>{const {journal}=fixture(async()=>({sync_status:'synced'}));await journal.append('in','A');const another=new PunchJournal({company:'other',user:'u',storage:journal.storage,uuid:()=>'',send:journal.send});assert.deepEqual(await another.read(),[])});
test('storage failure prevents sending an unpersisted punch',async()=>{let sent=false;const j=new PunchJournal({company:'c',user:'u',uuid:()=> 'valid-storage-failure-id',storage:{get:async()=>null,set:async()=>{throw Error('full')}},send:async()=>{sent=true}});await assert.rejects(j.append('in','A'),/full/);assert.equal(sent,false);});
test('shared lock preserves punches from two browser tabs',async()=>{const memory=new Map();let serial=Promise.resolve(),id=0;const lock=fn=>{const run=serial.then(fn);serial=run.catch(()=>{});return run;};const options={company:'c',user:'u',uuid:()=>String(++id),withLock:lock,storage:{get:async k=>memory.get(k)||null,set:async(k,v)=>memory.set(k,v)},send:async()=>({sync_status:'synced'})};const a=new PunchJournal(options),b=new PunchJournal(options);await Promise.all([a.append('in','A'),b.append('out')]);assert.equal((await a.read()).length,2);});

test('paid break metadata survives storage and projection without changing the punch session',async()=>{
 const memory=new Map();let sequence=0;const journal=new PunchJournal({company:'c',user:'u',uuid:()=>String(++sequence),storage:{get:async k=>memory.get(k),set:async(k,v)=>memory.set(k,v)},send:async()=>{throw Error('offline')}});
 await journal.append('break_start',null,null,'2026-10-01T10:00:00Z',true);await journal.flush();const events=await journal.read();assert.equal(events[0].paid,true);const state=projectPendingPunches({sessions:[{id:'session',started_at:'2026-10-01T08:00:00Z',ended_at:null}],segments:[],breaks:[]},events);assert.equal(state.breaks[0].is_paid,true);assert.equal(state.breaks[0].session_id,'session');
});

test('offline IN, pause and OUT survive restart, reconnect in order and reconcile hours',async()=>{
 const company='test-company',user='test-worker',job='test-site';
 const storageMap=new Map();
 const storage={get:async key=>storageMap.get(key)||null,
  set:async(key,value)=>storageMap.set(key,value)};
 const server={sessions:[],segments:[],breaks:[]};
 const scope={company,user};
 const acknowledgments=[];
 let online=false,number=0;
 const sender=async event=>{
  if(!online)throw Error('offline');
  acknowledgments.push(event.id);
  const updated=projectPendingPunches(server,[event],scope);
  Object.assign(server,updated);
  return {sync_status:'synced',session_id:updated.active?.id||updated.sessions[0]?.id};
 };
 const options={company,user,storage,uuid:()=>String(++number),send:sender};
 const first=new PunchJournal(options);
 await first.append('in',job,null,'2026-11-02T08:00:00Z',false,true);
 await first.flush();
 await first.append('break_start',null,null,'2026-11-02T12:00:00Z',false,true);
 await first.append('break_end',null,null,'2026-11-02T12:30:00Z',false,true);
 await first.append('out',null,null,'2026-11-02T16:00:00Z',false,true);
 const unconfirmed=await first.read();
 assert.equal(unconfirmed.length,4);
 assert.deepEqual(unconfirmed.map(e=>e.action),['in','break_start','break_end','out']);
 assert.deepEqual(unconfirmed.map(e=>e.previous),[null,'1','2','3']);
 assert.ok(unconfirmed.every(e=>e.offline===true));
 const projected=projectPendingPunches(server,unconfirmed,scope);
 assert.equal(projected.active,null,'OUT closes the locally projected session');
 assert.equal(projected.sessions[0].started_at,'2026-11-02T08:00:00Z');
 assert.equal(projected.sessions[0].ended_at,'2026-11-02T16:00:00Z');
 assert.equal(projected.breaks.length,1);
 assert.equal(projected.breaks[0].started_at,'2026-11-02T12:00:00Z');
 assert.equal(projected.breaks[0].ended_at,'2026-11-02T12:30:00Z');
 assert.equal(projected.segments[0].job_id,job);
 assert.deepEqual(acknowledgments,[],'No server event while offline');
 // A fresh instance reads the persisted queue, as after an app restart.
 const restored=new PunchJournal({...options,uuid:()=>String(++number)});
 assert.equal((await restored.pending()).length,4);
 online=true;
 const synced=await restored.flush();
 assert.equal(synced.sent,4);
 assert.equal(synced.pending,0);
 assert.deepEqual(acknowledgments,['1','2','3','4']);
 assert.equal((await restored.pending()).length,0);
 assert.ok((await restored.read()).every(e=>e.status==='synced'));
 assert.equal(server.sessions[0].ended_at,'2026-11-02T16:00:00Z');
 assert.equal(server.breaks[0].ended_at,'2026-11-02T12:30:00Z');
 const official=projectPendingPunches(server,await restored.read(),scope);
 assert.equal(official.sessions.length,1,'Reconciliation must not double count');
 assert.equal(official.segments.length,1);
 assert.equal(official.breaks.length,1);
 assert.equal(official.lastJobId,job);
 await restored.flush();
 assert.deepEqual(acknowledgments,['1','2','3','4'],'Never replay acknowledged events');
});


test('a server receipt for another event never acknowledges or drops the saved punch',async()=>{
 for(const receipt of [
  {sync_status:'synced',event_id:'another-event'},
  {sync_status:'conflict',event_id:'another-event',message:'Not our event'},
  {sync_status:'synced',event_id:null}
 ]){
  const received=[],{journal}=fixture(async event=>{
   received.push(event.id);return receipt;
  });
  const event=await journal.append('in','job-A',null,'2026-11-02T08:00:00Z',false,true);
  const result=await journal.flush();
  assert.equal(result.sent,0,'No unrelated server receipt can acknowledge this event');
  assert.equal(result.pending,1,'Original event stays queued');
  const saved=(await journal.read())[0];
  assert.equal(saved.id,event.id,'Idempotency UUID must be preserved');
  assert.equal(saved.status,'pending');
  assert.equal(saved.offline,true);
  assert.match(saved.error,/Accusé serveur invalide/);
  assert.deepEqual(received,[event.id]);
 }
});

test('a valid matching receipt replays the exact same event, including legacy breaks without event_id',async()=>{
 let response={sync_status:'synced',event_id:'other'},calls=[];
 const {journal}=fixture(async event=>{calls.push(event.id);return response;});
 const recorded=await journal.append('in','job-A',null,'2026-11-02T08:00:00Z');
 await journal.flush();
 response={sync_status:'synced',event_id:recorded.id};
 const accepted=await journal.flush();
 assert.equal(accepted.pending,0);
 assert.deepEqual(calls,[recorded.id,recorded.id]);
 assert.equal((await journal.read())[0].result.event_id,recorded.id);
 await journal.append('break_start',null,null,'2026-11-02T12:00:00Z');
 response={sync_status:'synced',session_id:'server-session'};
 const legacy=await journal.flush();
 assert.equal(legacy.pending,0,'Existing break RPCs do not return event_id');
 assert.equal((await journal.read())[1].status,'synced');
 await journal.flush();
 assert.deepEqual(calls,[recorded.id,recorded.id,'2'],'No acknowledged replay');
});
