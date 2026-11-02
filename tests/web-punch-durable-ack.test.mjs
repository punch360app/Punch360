import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PunchJournal,hasUnsafePunchJournalEntries,normalizeFreshPunchFix} from '../web/live/journal.js';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const begin=app.indexOf('async function locatedPunch(');
const end=app.indexOf("window.addEventListener('online'",begin);
assert.ok(begin>0&&end>begin,'Web punch function must exist');
const source=app.slice(begin,end);
function harness({online=false,send=async()=>({sync_status:'synced',review_status:'pending'}),
 flushThrows=false,hideEvent=false,readThrows=false}={}){
 let onLine=online,id=0;
 const memory=new Map(),sent=[];
 const storage={get:async k=>memory.get(k)||null,set:async(k,v)=>memory.set(k,v)};
 const journal=new PunchJournal({company:'company-A',user:'worker-A',
  uuid:()=>String(++id),storage,send:async event=>{sent.push(event.id);
   if(!onLine)throw Error('Offline');return send(event)}});
 const exposed=Object.create(journal);
 if(flushThrows)exposed.flush=async()=>{throw Error('Refresh unavailable')};
 if(hideEvent){exposed.flush=async()=>({events:[]});exposed.read=async()=>[]}
 if(readThrows){exposed.flush=async()=>{throw Error('Refresh unavailable')};
  exposed.read=async()=>{throw Error('Unreadable')}}
 const go=new Function('isEssential','essentialMobilePunchAllowed','freshPunchFix',
  'normalizeFreshPunchFix','punchJournal','navigator','hasUnsafePunchJournalEntries',
  source+'\nreturn locatedPunch;')(
  ()=>true,()=>true,async()=>null,normalizeFreshPunchFix,
  ()=>exposed,{get onLine(){return onLine}},hasUnsafePunchJournalEntries);
 return {run:(action='in',job='site-A')=>go(action,job),
  journal,memory,sent,setOnline:value=>{onLine=value}};
}
test('offline Web PUNCH IN is durable pending and replays same ID after reconnect',async()=>{
 const h=harness(),r=await h.run();
 assert.deepEqual(r,{queued:true,review_status:'local'});
 const pending=await h.journal.read();
 assert.equal(pending.length,1);
 assert.equal(pending[0].status,'pending');
 assert.deepEqual(h.sent,['1']);
 h.setOnline(true);
 const synced=await h.journal.flush();
 assert.equal(synced.pending,0);
 assert.equal(synced.events[0].status,'synced');
 assert.deepEqual(h.sent,['1','1']);
});
test('Web only claims synchronized status after a persisted server acknowledgement',async()=>{
 const h=harness({online:true,send:async()=>({sync_status:'synced',review_status:'pending',session_id:'session-A'})});
 const r=await h.run();
 assert.equal(r.queued,false);
 assert.equal(r.review_status,'pending');
 assert.equal(r.session_id,'session-A');
 assert.deepEqual((await h.journal.read()).map(e=>e.status),['synced']);
});
test('Web recovers a pending event from durable storage when flush throws',async()=>{
 const h=harness({flushThrows:true});
 assert.deepEqual(await h.run(),{queued:true,review_status:'local'});
 assert.equal((await h.journal.read())[0].status,'pending');
 assert.deepEqual(h.sent,[]);
});
test('missing event after append is an error, never a fabricated confirmation',async()=>{
 const h=harness({hideEvent:true});
 await assert.rejects(h.run(),/Statut du pointage introuvable/);
 assert.equal((await h.journal.read()).length,1);
 assert.deepEqual(h.sent,[]);
});
test('unreadable journal after append requires recovery, not another punch',async()=>{
 const h=harness({readThrows:true});
 await assert.rejects(h.run(),/journal illisible/);
 assert.equal((await h.journal.read()).length,1);
});
test('Web server conflict remains stored and is never reported as a success',async()=>{
 const h=harness({online:true,send:async()=>({sync_status:'conflict',message:'Manager review'})});
 await assert.rejects(h.run(),/Conflit de pointage conservé/);
 assert.deepEqual((await h.journal.read()).map(e=>e.status),['conflict']);
});
test('invalid server acknowledgement remains pending, not delivered',async()=>{
 const h=harness({online:true,send:async()=>({sync_status:'unknown'})});
 assert.deepEqual(await h.run(),{queued:true,review_status:'local'});
 assert.equal((await h.journal.read())[0].status,'pending');
});
test('Web pause and transfer messages use this event, never another pending event',()=>{
 assert.match(app,/const result=await locatedPunch\(activeBreak\(\)\?'break_end':'break_start',null,paid\)/);
 assert.match(app,/result\.review_status==='local'\?'Pause conservée sur cet appareil/);
 assert.match(app,/result\.review_status==='local'\?'Transfert conservé sur cet appareil/);
 assert.match(app,/catch\(err\)\{error\(err\);return\}finally\{state\.busy=false\}\}state\.selected=id/);
 assert.doesNotMatch(app,/toast\(state\.localPending\?'Pause conservée/);
});
