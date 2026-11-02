import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PunchJournal,hasUnsafePunchJournalEntries} from '../web/live/journal.js';

const good=(id,status='pending')=>({id,company:'company-A',user:'employee-A',
 action:'in',occurredAt:'2026-11-02T11:00:00Z',job:'site-A',fix:null,
 previous:null,offline:false,status});
function setup(rows,send=async()=>({sync_status:'synced'})){
 const memory=new Map(),key='punch-journal-v1:employee-A:company-A';
 memory.set(key,JSON.stringify(rows));
 const storage={get:async k=>memory.get(k)||null,
  set:async(k,v)=>memory.set(k,v)};
 const journal=new PunchJournal({company:'company-A',user:'employee-A',
  storage,uuid:()=>String(memory.size),send});
 return {journal,memory,key,storage};
}
test('foreign company event prevents any sync or append and keeps original bytes',async()=>{
 const calls=[],h=setup([{...good('foreign'),company:'company-B'},good('own')],
  async e=>{calls.push(e.id);return {sync_status:'synced'}});
 const initial=h.memory.get(h.key);
 for(let i=0;i<2;i++)await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
 await assert.rejects(h.journal.append('out'),/aucune nouvelle opération ajoutée/);
 assert.deepEqual(calls,[]);
 assert.equal(h.memory.get(h.key),initial);
 assert.deepEqual((await h.journal.pending()).map(e=>e.id),['foreign','own']);
});
test('a foreign employee already marked synced also blocks dependent queued punches',async()=>{
 const sent=[],h=setup([{...good('other','synced'),user:'employee-B'},good('pending')],
  async e=>{sent.push(e.id);return {sync_status:'synced'}});
 await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
 assert.deepEqual(sent,[]);
 assert.deepEqual((await h.journal.pending()).map(e=>e.id),['pending']);
});
test('tampered events fail closed before any network or local write',async()=>{
 const invalid=[
  null,{...good('u'),user:null},{...good('u'),id:5},
  {...good('u'),action:'delete'},{...good('u'),status:'review'},
  {...good('u'),occurredAt:'not-a-time'},
  {...good('u'),previous:42},{...good('u'),paid:'true'},
  {...good('u'),offline:'yes'}
 ];
 for(const row of invalid){
  const h=setup([row,good('own')],async()=>{throw Error('must not reach network')});
  const before=h.memory.get(h.key);
  assert.equal(hasUnsafePunchJournalEntries([row,good('own')],'company-A','employee-A'),true);
  await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
  await assert.rejects(h.journal.append('in','site-A'),/aucune nouvelle opération ajoutée/);
  assert.equal(h.memory.get(h.key),before);
 }
});
test('a clean offline journal retries immutable punches in order after reconnect',async()=>{
 let online=false;const seen=[],h=setup([],async event=>{
  seen.push(event.id);if(!online)throw Error('Network down');
  return {sync_status:'synced'};
 });
 await h.journal.append('in','site-A',null,'2026-11-02T11:00:00Z');
 // Give each test operation a distinct client ID, just like the UUID production adapter.
 h.journal.uuid=()=> 'second-id';
 await h.journal.append('out',null,null,'2026-11-02T16:00:00Z');
 const before=await h.journal.read();assert.equal(hasUnsafePunchJournalEntries(before,'company-A','employee-A'),false);
 const retry=await h.journal.flush();assert.equal(retry.pending,2);
 assert.deepEqual(seen,['1']);
 online=true;
 const acknowledged=await h.journal.flush();
 assert.equal(acknowledged.pending,0);
 assert.deepEqual(seen,['1','1','second-id']);
 assert.deepEqual((await h.journal.read()).map(e=>e.id),['1','second-id']);
});
test('repairing a contaminated journal in isolated storage permits normal replay',async()=>{
 const sent=[],h=setup([{...good('foreign'),user:'employee-B'},good('own')],
  async e=>{sent.push(e.id);return {sync_status:'synced'}});
 await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
 assert.deepEqual(sent,[]);
 // Simulate an explicit external recovery: the journal never auto-deletes.
 h.memory.set(h.key,JSON.stringify([good('own')]));
 const result=await h.journal.flush();
 assert.equal(result.pending,0);
 assert.deepEqual(sent,['own']);
});
test('validated statuses and identity are required, but clean empty queues are accepted',async()=>{
 assert.equal(hasUnsafePunchJournalEntries([], 'company-A','employee-A'),false);
 assert.equal(hasUnsafePunchJournalEntries([good('s','synced'),good('c','conflict')],
  'company-A','employee-A'),false);
 assert.equal(hasUnsafePunchJournalEntries([good('a')],'company-A','wrong-worker'),true);
 assert.equal(hasUnsafePunchJournalEntries([good('a')],'wrong-company','employee-A'),true);
 assert.equal(hasUnsafePunchJournalEntries({},'company-A','employee-A'),true);
 const h=setup([]);
 assert.equal((await h.journal.flush()).sent,0);
 assert.equal((await h.journal.pending()).length,0);
});
test('Web reports a contaminated journal instead of claiming sync; Expo uses shared code',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const expo=readFileSync(new URL('../src/punch/journal.ts',import.meta.url),'utf8');
 assert.match(app,/hasUnsafePunchJournalEntries\(events,companyId,userId\)/);
 assert.match(app,/Journal local à vérifier : aucun pointage envoyé/);
 assert.match(expo,/import \{PunchJournal,hasUnsafePunchJournalEntries\} from '\.\.\/\.\.\/web\/live\/journal.js'/);
});

test('duplicate local event IDs block all sends and appends without losing recovery bytes',async()=>{
 const sent=[],first=good('same-id'),second={...good('same-id'),action:'out',previous:'same-id'};
 const h=setup([first,second],async e=>{sent.push(e.id);return {sync_status:'synced'}});
 const before=h.memory.get(h.key);
 assert.equal(hasUnsafePunchJournalEntries([first,second],'company-A','employee-A'),true);
 await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
 await assert.rejects(h.journal.append('break_start'),/aucune nouvelle opération ajoutée/);
 assert.deepEqual(sent,[],'A duplicate id must never be sent as two different actions');
 assert.equal(h.memory.get(h.key),before,'Do not silently discard or mutate corrupted events');
 assert.deepEqual((await h.journal.pending()).map(e=>e.action),['in','out']);
});

test('duplicate local IDs are invalid across pending, synced and conflict status',async()=>{
 for(const status of ['pending','synced','conflict']){
  const h=setup([good('same-id','synced'),{...good('same-id',status),action:'out'}]);
  assert.equal(hasUnsafePunchJournalEntries(await h.journal.read(),'company-A','employee-A'),true,status);
  await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
 }
 const valid=[good('first-id','synced'),{...good('second-id'),action:'out',previous:'first-id'}];
 assert.equal(hasUnsafePunchJournalEntries(valid,'company-A','employee-A'),false);
});

test('a colliding new UUID cannot poison an otherwise valid stored journal',async()=>{
 for(const status of ['pending','synced','conflict']){
  const sent=[],h=setup([good('repeated',status)],async event=>{
   sent.push(event.id);return {sync_status:'synced'};
  });
  h.journal.uuid=()=> 'repeated';
  const before=h.memory.get(h.key);
  await assert.rejects(h.journal.append('out',null,null,'2026-11-02T16:00:00Z'),/aucun ajout enregistré/);
  assert.equal(h.memory.get(h.key),before,'Existing journal must remain byte-for-byte unchanged: '+status);
  assert.equal((await h.journal.read()).length,1);
  assert.deepEqual(sent,[],'Never send an unpersisted collision');
 }
});

test('after a rejected UUID collision a distinct event can still be appended and synced',async()=>{
 const sent=[],h=setup([good('original','synced')],async event=>{
  sent.push(event.id);return {sync_status:'synced'};
 });
 h.journal.uuid=()=> 'original';
 await assert.rejects(h.journal.append('out'),/aucun ajout enregistré/);
 h.journal.uuid=()=> 'fresh';
 const saved=await h.journal.append('out',null,null,'2026-11-02T16:00:00Z');
 assert.equal(saved.id,'fresh');
 assert.equal(saved.previous,'original');
 assert.equal(hasUnsafePunchJournalEntries(await h.journal.read(),'company-A','employee-A'),false);
 const transmitted=await h.journal.flush();
 assert.equal(transmitted.pending,0);
 assert.deepEqual(sent,['fresh']);
 assert.deepEqual((await h.journal.read()).map(e=>e.status),['synced','synced']);
});

test('malformed new events fail before storage or upload, without corrupting clean queue',async()=>{
 const h=setup([]);
 const original=h.memory.get(h.key);
 for(const options of [
  {id:''},{id:null},{id:42},{id:'new',action:'unknown'},
  {id:'new',action:'in',occurredAt:'unparsable'}
 ]){
  h.journal.uuid=()=>options.id;
  await assert.rejects(h.journal.append(options.action||'in','site',null,options.occurredAt||'2026-11-02T08:00:00Z'),
   /aucun ajout enregistré/);
  assert.equal(h.memory.get(h.key),original);
 }
 assert.deepEqual(await h.journal.read(),[]);
});

test('new offline IN and transfer must include a nonempty workplace without poisoning the queue',async()=>{
 const sent=[],h=setup([],async e=>{sent.push(e.action);return {sync_status:'synced'}});
 let next=0;h.journal.uuid=()=>String(++next);
 const original=h.memory.get(h.key);
 for(const action of ['in','transfer']){
  for(const invalid of [undefined,null,'','   ',42]){
   await assert.rejects(h.journal.append(action,invalid),/Établissement de pointage requis/);
   assert.equal(h.memory.get(h.key),original,'Invalid workplace cannot be persisted');
  }
 }
 assert.deepEqual(sent,[]);
 const entered=await h.journal.append('in','JOB-123',null,'2026-11-02T08:00:00Z',false,true);
 assert.equal(entered.job,'JOB-123');
 assert.equal(entered.id,'1','Rejected validation does not consume UUID');
 const moved=await h.journal.append('transfer','JOB-456',null,'2026-11-02T09:00:00Z',false,true);
 assert.equal(moved.job,'JOB-456');
 const out=await h.journal.append('out',null,null,'2026-11-02T17:00:00Z',false,true);
 assert.equal(out.job,null);
 assert.equal(hasUnsafePunchJournalEntries(await h.journal.read(),'company-A','employee-A'),false);
 await h.journal.flush();
 assert.deepEqual(sent,['in','transfer','out']);
});
test('breaks and closing an existing shift remain independent of workplace argument',async()=>{
 const h=setup([]);
 h.journal.uuid=(() => {let n=0;return ()=>String(++n)})();
 for(const action of ['break_start','break_end','out']){
  const event=await h.journal.append(action,null,null,'2026-11-02T12:00:00Z',false,true);
  assert.equal(event.job,null);
 }
 assert.deepEqual((await h.journal.read()).map(e=>e.action),['break_start','break_end','out']);
});

test('legacy unassigned IN and transfer records are quarantined before replay, preserving exact bytes',async()=>{
 for(const action of ['in','transfer']){
  for(const badJob of [undefined,null,'','   ',42]){
   const row={...good('legacy-unsafe'),action,job:badJob};
   const sent=[],h=setup([row],async e=>{sent.push(e.id);return {sync_status:'synced'}});
   const before=h.memory.get(h.key);
   assert.equal(hasUnsafePunchJournalEntries(await h.journal.read(),'company-A','employee-A'),true);
   await assert.rejects(h.journal.flush(),/aucun envoi effectué/);
   await assert.rejects(h.journal.append('out'),/aucune nouvelle opération ajoutée/);
   assert.deepEqual(sent,[]);
   assert.equal(h.memory.get(h.key),before,'Quarantine never edits or deletes old records');
  }
 }
});

test('well-formed legacy IN followed by jobless OUT and breaks still synchronizes',async()=>{
 const events=[
  {...good('in'),action:'in',job:'job-1'},
  {...good('break'),action:'break_start',job:null,previous:'in'},
  {...good('out'),action:'out',job:null,previous:'break'}
 ];
 const sent=[],h=setup(events,async event=>{sent.push(event.action);return {sync_status:'synced'}});
 assert.equal(hasUnsafePunchJournalEntries(events,'company-A','employee-A'),false);
 const result=await h.journal.flush();
 assert.equal(result.pending,0);
 assert.deepEqual(sent,['in','break_start','out']);
});
