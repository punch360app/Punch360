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
 flushThrows=false,hideEvent=false,readThrows=false,gpsFix=async()=>null}={}){
 let onLine=online,id=0,companyId='company-A',userId='worker-A';
 const memory=new Map(),sent=[];
 const storage={get:async k=>memory.get(k)||null,set:async(k,v)=>memory.set(k,v)};
 const journal=new PunchJournal({company:'company-A',user:'worker-A',
  uuid:()=>String(++id),storage,send:async event=>{sent.push(event.id);
   if(!onLine)throw Error('Offline');return send(event)}});
 const exposed=Object.create(journal);
 if(flushThrows){exposed.flush=async()=>{throw Error('Refresh unavailable')};
  exposed.inspect=async()=>{throw Error('Inspection unavailable')}};
 if(hideEvent){exposed.flush=async()=>({events:[]});exposed.inspect=async()=>({events:[]});exposed.read=async()=>[]}
 if(readThrows){exposed.flush=async()=>{throw Error('Refresh unavailable')};
  exposed.inspect=async()=>{throw Error('Inspection unavailable')};
  // Append must first read and persist successfully. Simulate a storage
  // read failure only during the subsequent status recovery.
  let reads=0;
  exposed.read=async()=>++reads===1?journal.read():Promise.reject(Error('Unreadable'))}
 const go=new Function('isEssential','essentialMobilePunchAllowed','freshPunchFix',
  'normalizeFreshPunchFix','punchJournal','navigator','hasUnsafePunchJournalEntries',
  'company','state','member',source+'\nreturn locatedPunch;')(
  ()=>true,()=>true,gpsFix,normalizeFreshPunchFix,
  ()=>exposed,{get onLine(){return onLine}},hasUnsafePunchJournalEntries,
  ()=>companyId,{user:{get id(){return userId}}},()=>true);
 return {run:(action='in',job='site-A')=>go(action,job),
  journal,memory,sent,setOnline:value=>{onLine=value},
  setScope:(nextCompany,nextUser)=>{companyId=nextCompany;userId=nextUser}};
}
test('offline Web PUNCH IN is durable pending and replays same ID after reconnect',async()=>{
 const h=harness(),r=await h.run();
 assert.deepEqual(r,{queued:true,review_status:'local'});
 const pending=await h.journal.read();
 assert.equal(pending.length,1);
 assert.equal(pending[0].status,'pending');
 assert.deepEqual(h.sent,[],'Offline capture must not attempt network upload');
 h.setOnline(true);
 const synced=await h.journal.flush();
 assert.equal(synced.pending,0);
 assert.equal(synced.events[0].status,'synced');
 assert.deepEqual(h.sent,['1'],'Reconnect sends the original durable ID once');
});
test('Web only claims synchronized status after a persisted server acknowledgement',async()=>{
 const h=harness({online:true,send:async()=>({sync_status:'synced',review_status:'pending',session_id:'session-A'})});
 const r=await h.run();
 assert.equal(r.queued,false);
 assert.equal(r.review_status,'pending');
 assert.equal(r.session_id,'session-A');
 assert.deepEqual((await h.journal.read()).map(e=>e.status),['synced']);
});
test('Web recovers a pending event from durable storage when offline inspection throws',async()=>{
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

test('changing company while GPS permission is pending never creates a punch in either account',async()=>{
 let resolveFix;
 const gpsFix=()=>new Promise(resolve=>{resolveFix=resolve});
 const h=harness({online:true,gpsFix});
 const running=h.run();
 assert.equal(typeof resolveFix,'function');
 h.setScope('company-B','worker-B');
 resolveFix({latitude:46.8,longitude:-71.2,accuracy:4});
 await assert.rejects(running,/Compte ou entreprise changé pendant la capture/);
 assert.deepEqual(await h.journal.read(),[]);
 assert.deepEqual(h.sent,[]);
});
test('workspace switch after durable append hides old-company result without losing the punch',async()=>{
 let started,complete;
 const submitted=new Promise(resolve=>{started=resolve});
 const h=harness({online:true,send:async()=>{
  started();return new Promise(resolve=>{complete=resolve});
 }});
 const running=h.run();
 await submitted;
 h.setScope('company-B','worker-B');
 complete({sync_status:'synced',review_status:'pending'});
 await assert.rejects(running,/Compte ou entreprise changé : pointage conservé/);
 assert.equal((await h.journal.read()).length,1);
 assert.equal((await h.journal.read())[0].status,'synced');
 assert.deepEqual(h.sent,['1']);
});
test('Web punch confirmation describes device capture and never claims GPS was inside radius',()=>{
 const punch=app.slice(app.indexOf('async function doPunch()'),app.indexOf('async function selectJob('));
 assert.match(punch,/Heure captée sur cet appareil, soumise à vérification du serveur/);
 assert.match(punch,/Punch transmis au serveur — heures sujettes à validation/);
 assert.doesNotMatch(punch,/Horodatage serveur|position dans le rayon/);
});
