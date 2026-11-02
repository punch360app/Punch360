import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPunchSyncState,localPunchStatusSummary,isOwnPunchJournalEvent} from '../web/live/punch-sync-state.js';

const own={id:'evt-a',company:'business-A',user:'worker-A',status:'pending',
 action:'in',occurredAt:'2026-11-01T10:00:00Z',fix:{latitude:47,longitude:-71},
 job:'private-job',result:{secret:'no-show'}};

test('only pending punches of the authenticated company and employee appear',()=>{
 const found=localPunchSyncState([
  {...own,company:'business-B',id:'foreign-business'},
  {...own,user:'worker-B',id:'foreign-user'},
  own,{...own,id:'evt-b',action:'break_start',occurredAt:'2026-11-01T11:00:00Z'}
 ],'business-A','worker-A');
 assert.deepEqual(found.pending,[
  {label:'Entrée',occurredAt:'2026-11-01T10:00:00Z'},
  {label:'Début de pause',occurredAt:'2026-11-01T11:00:00Z'}
 ]);
 assert.deepEqual(found.conflicts,[]);
 assert.doesNotMatch(JSON.stringify(found),/private-job|secret|latitude|longitude/);
});

test('server conflicts remain separate from pending transmissions',()=>{
 const found=localPunchSyncState([
  {...own,id:'already-synced',status:'synced'},
  {...own,id:'server-conflict',status:'conflict',action:'out'},
  {...own,id:'pending-transfer',action:'transfer'}
 ],'business-A','worker-A');
 assert.deepEqual(found.pending,[{label:'Changement de chantier',occurredAt:own.occurredAt}]);
 assert.deepEqual(found.conflicts,[{label:'Sortie',occurredAt:own.occurredAt}]);
});

test('bad data and unknown actions never leak raw event details',()=>{
 for(const value of [null,{},'oops',[],[null],[
  {...own,status:'pending',id:''},
  {...own,id:'legacy',action:'malicious <img onerror=alert(1)>',occurredAt:'not a date'}
 ]]){
  const s=localPunchSyncState(value,'business-A','worker-A');
  assert.ok(Array.isArray(s.pending)&&Array.isArray(s.conflicts));
  assert.doesNotMatch(JSON.stringify(s),/<img|alert\(/);
 }
 const legacy=localPunchSyncState([{...own,id:'legacy',action:'not-listed',occurredAt:'invalid'}],'business-A','worker-A');
 assert.deepEqual(legacy.pending,[{label:'Action inconnue',occurredAt:null}]);
 assert.deepEqual(localPunchSyncState([own],'business-A','other-worker'),{pending:[],conflicts:[]});
});

test('employee UI shares a scoped journal status on home and hours, with manual retry',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{localPunchSyncState,localPunchStatusSummary,isOwnPunchJournalEvent\} from '\.\/punch-sync-state\.js';/);
 assert.match(app,/function essentialPunchSyncPanel\(\)/);
 assert.match(app,/essentialPunchSyncPanel\(\)/);
 assert.match(app,/data-action="syncPendingPunches"|button\('Synchroniser maintenant','syncPendingPunches'/);
 assert.match(app,/if\(a==='syncPendingPunches'\)/);
 assert.match(app,/state\.localPunchEvents=events/);
 assert.match(app,/state\.localPunchEvents=\[\]/);
});

test('summary keeps server conflicts, local pending and unverifiable snapshots distinct',()=>{
 const args={events:[],companyId:'business-A',userId:'worker-A',
  snapshotCompanyId:'business-A',snapshotFetchedAt:Date.parse('2026-11-02T10:00:00Z')};
 assert.deepEqual(localPunchStatusSummary(args),{kind:'server',label:'Dernier relevé serveur'});
 assert.deepEqual(localPunchStatusSummary({...args,snapshotCompanyId:'business-B'}),{kind:'unverified',label:'Relevé à vérifier'});
 assert.deepEqual(localPunchStatusSummary({...args,snapshotFetchedAt:null}),{kind:'unverified',label:'Relevé à vérifier'});
 assert.deepEqual(localPunchStatusSummary({...args,events:[own]}),{kind:'pending',label:'En attente d’envoi'});
 assert.deepEqual(localPunchStatusSummary({...args,events:[{...own,status:'conflict'}]}),{kind:'conflict',label:'Conflit à vérifier'});
 assert.deepEqual(localPunchStatusSummary({...args,events:[own,{...own,id:'another',status:'conflict'}]}),{kind:'mixed',label:'En attente et conflit à vérifier'});
 assert.equal(localPunchStatusSummary({...args,events:[{...own,company:'other-company',status:'conflict'}]}).kind,'server');
});

test('blocked local journal takes priority over last server snapshot without exposing other users',()=>{
 const args={events:[],companyId:'business-A',userId:'worker-A',
  snapshotCompanyId:'business-A',snapshotFetchedAt:Date.parse('2026-11-02T10:00:00Z')};
 const blocked={kind:'blocked',label:'Journal local à vérifier'};
 assert.deepEqual(localPunchStatusSummary({...args,journalBlocked:true}),blocked);
 assert.deepEqual(localPunchStatusSummary({...args,events:[own],journalBlocked:true}),blocked);
 assert.deepEqual(localPunchStatusSummary({...args,events:[{...own,status:'conflict'}],journalBlocked:true}),blocked);
 assert.deepEqual(localPunchStatusSummary({...args,journalBlocked:false}),
  {kind:'server',label:'Dernier relevé serveur'});
 assert.equal(localPunchStatusSummary({...args,userId:null,journalBlocked:true}).kind,'server');
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const home=app.slice(app.indexOf('function essentialHome(){'),app.indexOf('function essentialSchedule()',app.indexOf('function essentialHome(){')));
 assert.match(home,/journalBlocked:state\\.localJournalBlocked\\?\\.companyId===company\\(\\)&&state\\.localJournalBlocked\\?\\.userId===state\\.user\\?\\.id/);
 assert.match(app,/Journal local non vérifiable : la synchronisation et les nouveaux pointages/);
});
test('manual resynchronization checks the persisted journal after retry and does not claim payroll confirmation',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{localPunchSyncState,localPunchStatusSummary,isOwnPunchJournalEvent\} from '\.\/punch-sync-state\.js'/);
 assert.match(app,/function essentialHome\(\)\{const punchStatus=localPunchStatusSummary\(/);
 assert.match(app,/e\(punchStatus\.label\)/);
 assert.doesNotMatch(app,/state\.localPending\?'Sauvegardé ici':tr\('synchronized'\)/);
 assert.match(app,/const events=await punchJournal\(\)\.read\(\)/);
 assert.match(app,/state\.localPunchEvents=events/);
 assert.match(app,/state\.localPending=pending\.length/);
 assert.match(app,/pending\.length&&conflicts\.length/);
 assert.match(app,/Vérifiez le relevé serveur avant de considérer vos heures confirmées/);
});

test('journal flush receipt refreshes UI state before independent Supabase reads',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
 const start=app.indexOf('async function loadData(){');
 const end=app.indexOf('async function reload(',start);
 assert.ok(start>=0&&end>start);
 const loader=app.slice(start,end);
 assert.match(loader,/try\{flushed=await journal\.flush\(\)\}catch\{journalBlocked=true\}/);
 assert.match(loader,/state\.localJournalBlocked=journalBlocked\?\{companyId,userId\}:null/);
 assert.match(loader,/const syncState=localPunchSyncState\(flushed\.events,companyId,userId\)/);
 assert.match(loader,/state\.localPunchEvents=flushed\.events/);
 assert.match(loader,/state\.localPending=syncState\.pending\.length/);
 assert.ok(loader.indexOf('state.localPunchEvents=flushed.events')<loader.indexOf('const calls=await Promise.all('));
 assert.match(sw,/'\.\/punch-sync-state\.js'/);
});

test('journal ownership is checked before upload, not only before displaying events',()=>{
 assert.equal(isOwnPunchJournalEvent(own,'business-A','worker-A'),true);
 for(const bad of [
  null,{}, {...own,company:'business-B'}, {...own,user:'worker-B'},
  {...own,id:''}, {...own,id:12}
 ])assert.equal(isOwnPunchJournalEvent(bad,'business-A','worker-A'),false);
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/send:async event=>\{if\(!member\(\)\|\|!isOwnPunchJournalEvent\(event,company\(\),state\.user\?\.id\)\)throw/);
 assert.match(app,/state\.localPending=localPunchSyncState\(events,companyId,userId\)\.pending\.length;state\.localPunchEvents=events/g);
 assert.doesNotMatch(app,/state\.localPending=pending\.length;state\.localPunchEvents=events;/);
});

test('conflict recovery navigation stays inside confirmed hours and scoped corrections',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const start=app.indexOf('function essentialPunchSyncPanel()');
 const end=app.indexOf('function essentialHome()',start);
 assert.ok(start>=0&&end>start);
 const panel=app.slice(start,end);
 assert.match(panel,/conflicts\.length>5/);
 assert.match(panel,/state\.section==='hours'\?button\('Vérifier les corrections possibles','subpage','full','data-id="essentialCorrection"'\)/);
 assert.match(panel,/button\('Consulter Mes heures','navigate','full','data-id="hours"'\)/);
 assert.match(panel,/journée vérifiée sur le serveur/);
 assert.match(panel,/contactez votre responsable/);
 assert.doesNotMatch(panel,/latitude|longitude|fix\.|result\.message/);
});
