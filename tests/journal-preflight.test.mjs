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
