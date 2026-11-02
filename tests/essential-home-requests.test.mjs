import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Evaluate the actual home renderer with scoped, inert dependencies. Never
// connect to Supabase or mutate production state during a UI test.
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const start=app.indexOf('function essentialRequestsHomeCard()');
const end=app.indexOf('function essentialHome()',start);
assert.ok(start>=0&&end>start,'real home card must exist');

function homeCard(timeline){
 const calls=[];
 const companyId='company-a',userId='employee-a';
 const state={user:{id:userId},account:{role:'employee'},
  serverPunchCompany:companyId,serverPunch:{sessions:[]},corrections:[],
  leavesLoaded:true,leaves:[],};
 const essentialUI={breakCorrections:{state:{company:companyId}},
  missingDays:{state:{company:companyId}}};
 const scoped=(name)=>args=>{calls.push({name,args});return {ready:true,requests:[]}};
 const build=new Function('company','state','essentialUI','employeeHoursRequestTimeline',
  'essentialCorrectionView','breakCorrectionInbox','employeeMissingDaysSummary',
  'essentialLeaveView','button',app.slice(start,end)+'\nreturn essentialRequestsHomeCard;');
 const view=build(()=>companyId,state,essentialUI,args=>{calls.push({name:'timeline',args});return timeline;},
  scoped('corrections'),scoped('breaks'),scoped('missing'),scoped('leave'),
  (label,action,style,attributes)=>'<button data-action="'+action+'" '+attributes+'>'+label+'</button>');
 return {html:view(),calls};
}
test('home links to My Hours when personal requests are awaiting review',()=>{
 const {html,calls}=homeCard({complete:true,pendingCount:3,items:[
  {key:'congé:mine'},{key:'heures:mine'},{key:'journée:mine'}],unavailable:[]});
 assert.match(html,/Mes demandes en cours/);
 assert.match(html,/3 demande\(s\) en attente/);
 assert.match(html,/data-action="navigate" data-id="hours"/);
 assert.match(html,/Aucune demande en attente ne vaut approbation/);
 assert.deepEqual(calls.filter(c=>c.name!=='timeline').map(c=>c.name),
  ['corrections','breaks','missing','leave']);
 const timeline=calls.find(c=>c.name==='timeline').args;
 assert.equal(timeline.companyId,'company-a');
 assert.equal(timeline.userId,'employee-a');
 assert.ok(timeline.correctionView&&timeline.breakView&&timeline.missingView&&timeline.leaveView);
});
test('home stays compact when verified request inbox has no pending decisions',()=>{
 assert.equal(homeCard({complete:true,pendingCount:0,items:[],unavailable:[]}).html,'');
 assert.equal(homeCard({complete:true,pendingCount:0,items:[{status:'approved'}],unavailable:[]}).html,'');
});
test('partial read never describes the employee inbox as fully synchronized',()=>{
 const r=homeCard({complete:false,pendingCount:1,items:[{status:'pending'}],
  unavailable:['Congé ou absence']});
 assert.match(r.html,/Suivi partiel/);
 assert.match(r.html,/1 demande\(s\) en attente parmi les données chargées/);
 assert.doesNotMatch(r.html,/Toutes les demandes approuvées|0 demande\(s\) en attente/);
 const partial=homeCard({complete:false,pendingCount:0,items:[{status:'approved'}],
  unavailable:['Congé ou absence']});
 assert.match(partial.html,/doit être actualisé/);
 assert.doesNotMatch(partial.html,/0 demande\(s\) en attente/);
});
test('empty unverified inbox does not add an unhelpful home banner',()=>{
 const r=homeCard({complete:false,pendingCount:0,items:[],unavailable:[
  'Correction d’heures','Correction de pause','Journée oubliée','Congé ou absence']});
 assert.equal(r.html,'');
});
test('PWA home has the request card after offline journal and before upcoming schedule',()=>{
 const start=app.indexOf('function essentialHome()');
 const end=app.indexOf('function essentialSchedule()',start);
 const home=app.slice(start,end);
 assert.match(home,/essentialPunchSyncPanel\(\)\+essentialRequestsHomeCard\(\)\+essentialUpcomingHomeCard\(\)/);
});
