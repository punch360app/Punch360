import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const start=app.indexOf('let punchLoadRevision=0;'),end=app.indexOf('async function reload(',start);
assert.ok(start>=0&&end>start);
const source=app.slice(start,end);
const panelFrom=app.indexOf('function essentialPunchSyncPanel(){');
const panelTo=app.indexOf('function essentialRequestsHomeCard()',panelFrom);
assert.ok(panelFrom>=0&&panelTo>panelFrom);
const panelSource=app.slice(panelFrom,panelTo);
function fixture(journal){
 const state={account:{company_id:'A'},user:{id:'U'},localJournalBlocked:null,
  localPunchEvents:[],localPending:4,selected:null,
  serverPunchCompany:'A',serverPunch:{sessions:[{id:'verified',company_id:'A',user_id:'U',ended_at:null}],segments:[],breaks:[]},
  sessions:[],segments:[],breaks:[]};
 const calls={project:[],save:0};
 const loader=new Function('state','member','company','punchJournal','navigator',
 'projectPendingPunches','saveOfflineSnapshot','currentSession','localPunchSyncState',source+
 '\nreturn loadData;')(state,()=>!!state.user&&!!state.account,()=>state.account?.company_id,
 ()=>journal,{onLine:false},(snapshot,events,scope)=>{calls.project.push({events,scope});return {...snapshot,active:null,lastJobId:null}},
 ()=>calls.save++,()=>null,()=>({pending:[],conflicts:[]}));
 return {state,calls,load:loader};
}
test('an unreadable local journal shows only a confirmed snapshot, preserving it',async()=>{
 const h=fixture({flush:()=>{throw Error('Offline must never flush')},
  inspect:async()=>{throw Error('Journal invalide')}});
 await h.load();
 assert.deepEqual(h.state.localJournalBlocked,{companyId:'A',userId:'U'});
 assert.equal(h.state.localPending,0);
 assert.deepEqual(h.state.localPunchEvents,[]);
 assert.equal(h.state.sessions[0].id,'verified');
 assert.deepEqual(h.calls.project[0].events,[]);
 assert.equal(h.calls.save,0);
});
test('a successful offline retry clears warning and does not invent confirmation',async()=>{
 let blocked=true,inspections=0;
 const journal={flush:()=>{throw Error('Offline must never flush')},
  inspect:async()=>{inspections++;if(blocked)throw Error('unsafe');return {events:[],pending:0,sent:0}}};
 const h=fixture(journal);
 await h.load();assert.ok(h.state.localJournalBlocked);
 blocked=false;await h.load();
 assert.equal(h.state.localJournalBlocked,null);
 assert.equal(inspections,2);
 assert.equal(h.calls.save,1);
 assert.equal(h.state.localPending,0);
});
test('company switch during failed inspection cannot display stale warning',async()=>{
 let rejectInspection;
 const h=fixture({flush:()=>{throw Error('Offline must never flush')},
  inspect:()=>new Promise((_,reject)=>{rejectInspection=reject})});
 const request=h.load();h.state.account={company_id:'B'};
 rejectInspection(Error('unverified'));
 await request;
 assert.equal(h.state.localJournalBlocked,null);
 assert.equal(h.calls.project.length,0);
});
test('blocked journal shows banner even when pending and conflicts are empty',()=>{
 const state={account:{company_id:'A'},user:{id:'U'},
  localJournalBlocked:{companyId:'A',userId:'U'},localPunchEvents:[],section:'hours',busy:false};
 const panel=new Function('state','company','localPunchSyncState','button','navigator','e','when',
  panelSource+'\nreturn essentialPunchSyncPanel;')(state,()=>state.account.company_id,
  ()=>({pending:[],conflicts:[]}),()=>'<button>sync</button>',{onLine:true},x=>x,x=>x);
 assert.match(panel(),/Journal local non vérifiable/);
 assert.match(panel(),/heures serveur restent consultables/);
 assert.doesNotMatch(panel(),/Synchroniser maintenant/);
 state.account.company_id='B';assert.equal(panel(),'');
});
test('manual retry displays blocked warning before reading contaminated raw events',()=>{
 assert.match(app,/if\(state\.localJournalBlocked\?\.companyId===companyId&&state\.localJournalBlocked\.userId===userId\)/);
 assert.match(source,/journalBlocked\?\[\]:await journal\.read\(\)/);
 assert.match(source,/journalBlocked\?\[\]:await journal\.pending\(\)/);
});
