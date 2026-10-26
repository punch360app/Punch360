import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {ARRIVAL_ISSUE_LABELS,arrivalIssuePayload,canReportArrivalIssue,arrivalStatusLabel} from '../web/live/arrival-issues.js';
import {createArrivalIssuesController} from '../web/live/arrival-issues-controller.js';
import {createPlanningController} from '../web/live/planning.js';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shift={id:'shift-a',company_id:'tenant-a',worker_id:'worker-a',version:3,
 starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+9*3600000).toISOString(),timezone:'America/Toronto'};
function fixture(){
 const window=new Window();window.confirm=()=>true;
 let issue=null;
 const notifications=[],calls=[];
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='list_essential_shift_arrival_issues')return {data:{items:issue?[issue]:[],has_more:false}};
  if(name==='report_essential_shift_arrival_issue'){
   issue={id:'report-1',shift_id:'shift-a',worker_id:'worker-a',kind:args.p_kind,
    private_message:args.p_message,estimate_minutes:args.p_estimate_minutes,status:'reported',reported_at:new Date().toISOString()};
   return {data:{id:issue.id,status:'reported',duplicate:false}};
  }
  if(name==='ack_essential_shift_arrival_issue'){
   issue={...issue,status:'acknowledged'};
   return {data:{id:issue.id,status:'acknowledged',duplicate:false}};
  }
  if(name==='essential_entitlements')return{data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return{data:[{id:'worker-a',name:'Nadine',status:'active'}]};
  if(name==='list_essential_assigned_client_sites')return{data:{items:[],has_more:false}};
  if(name==='list_essential_clients'||name==='list_essential_client_sites')return{data:{items:[],has_more:false}};
  return {data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
  then(done){return Promise.resolve({data:table==='scheduled_shifts'?[shift]:[],error:null}).then(done)}};return q;}};
 return {window,sb,calls,notifications,issue:()=>issue};
}
test('validation rejects invented estimates and keeps notice strictly voluntary',()=>{
 assert.deepEqual(ARRIVAL_ISSUE_LABELS.map(x=>x[0]),['late','access']);
 assert.deepEqual(arrivalIssuePayload('late','Travaux sur la route','20'),{p_kind:'late',p_message:'Travaux sur la route',p_estimate_minutes:20});
 assert.deepEqual(arrivalIssuePayload('access','Porte verrouillée',''),{p_kind:'access',p_message:'Porte verrouillée',p_estimate_minutes:null});
 assert.throws(()=>arrivalIssuePayload('access','Porte verrouillée','20'),/Aucune estimation/);
 assert.throws(()=>arrivalIssuePayload('late','','241'),/1 et 240/);
 assert.throws(()=>arrivalIssuePayload('late','a'.repeat(501),''),/500/);
 assert.equal(canReportArrivalIssue(shift,'worker-a',null),true);
 assert.equal(canReportArrivalIssue(shift,'worker-b',null),false);
 assert.equal(canReportArrivalIssue({...shift,cancelled_at:new Date().toISOString()},'worker-a',null),false);
 assert.equal(canReportArrivalIssue({...shift,ends_at:new Date(Date.now()-14*3600000).toISOString()},'worker-a',null),false);
 assert.equal(arrivalStatusLabel({status:'acknowledged'}),'Pris en charge par le responsable');
});
test('employee reports own issue, manager acknowledges, employee sees acknowledgement; no punch or GPS call',async()=>{
 const f=fixture(),{window,sb,calls}=f;
 const ctrl=createArrivalIssuesController({sb,document:window.document,escape:e,redraw(){},notify(message){f.notifications.push(message)}});
 await ctrl.load('tenant-a','employee-a','worker-a','employee');
 assert.match(ctrl.renderControls(shift),/Prévenir d’un retard/);
 assert.equal(ctrl.renderInbox(),'');
 await ctrl.handle('open',{dataset:{id:'shift-a',kind:'late'}},[shift]);
 window.document.body.innerHTML=ctrl.renderForm([shift]);
 window.document.getElementById('arrival-message').value='Embouteillage annoncé';
 window.document.getElementById('arrival-eta').value='15';
 await ctrl.handle('report',{dataset:{id:'shift-a'}},[shift]);
 const sent=calls.find(x=>x.name==='report_essential_shift_arrival_issue');
 assert.equal(sent.args.p_shift,'shift-a');assert.equal(sent.args.p_expected_version,3);
 assert.equal(sent.args.p_estimate_minutes,15);
 assert.equal(ctrl.state.items.length,1);assert.match(ctrl.renderControls(shift),/en attente de prise en charge/);
 await ctrl.load('tenant-a','boss-a',null,'boss');
 assert.match(ctrl.renderInbox(),/Embouteillage annoncé/);
 await ctrl.handle('ack',{dataset:{id:'report-1'}},[shift]);
 assert.equal(calls.filter(x=>x.name==='ack_essential_shift_arrival_issue').length,1);
 assert.match(ctrl.renderInbox(),/Pris en charge par le responsable/);
 await ctrl.load('tenant-a','employee-a','worker-a','employee');
 assert.match(ctrl.renderControls(shift),/Pris en charge par le responsable/);
 assert.equal(calls.filter(x=>/punch|location|gps|pay|absence|change_shift/i.test(x.name)).length,0);
 await window.happyDOM.close();
});
test('real schedule UI shows only personal reporting, not coworker messages',async()=>{
 const f=fixture(),ui=createPlanningController({sb:f.sb,document:f.window.document,escape:e,redraw(){},notify(){}});
 await ui.load({company_id:'tenant-a',role:'employee'},'employee-a','worker-a',[]);
 ui.state.tab='calendar';
 const own=ui.renderSchedule();
 assert.match(own,/Prévenir d’un retard/);assert.match(own,/Signaler un problème d’accès/);
 await ui.handle({dataset:{action:'ess:plan-arrival-open',id:'shift-a',kind:'access'}});
 assert.match(ui.renderSchedule(),/Aucune arrivée/);
 await ui.load({company_id:'tenant-a',role:'employee'},'employee-b','worker-b',[]);
 ui.state.tab='calendar';
 assert.doesNotMatch(ui.renderSchedule(),/Prévenir d’un retard/);
 await f.window.happyDOM.close();
});
