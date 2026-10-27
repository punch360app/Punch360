import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';
import {missionIssueDecisionArgs,issueDecisionLabel,resolvedMissionNotice} from '../web/live/mission-issue-decision.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
const request='438b4e1b-4f27-4786-9c55-eb9e860a8651',day=missionDate();
const row={id:'mission-one',company_id:'company-A',worker_id:'worker-one',status:'impossible',version:2,
 title:'Visite à confirmer',sort_order:1,mission_day:day,site_name:'Site client',client_name:'Client privé',
 issue_reason:'access_blocked',issue_note:'Étage privé',first_name:'Nadine',last_name:'',site_id:'site-one'};
test('decision arguments reject invalid status, versions, actions and reasons',()=>{
 const a=missionIssueDecisionArgs('company-A',row,'resume','Retour autorisé',request);
 assert.deepEqual(a,{p_company:'company-A',p_mission:row.id,p_version:2,p_request:request,p_decision:'resume',p_reason:'Retour autorisé'});
 for(const bad of [{...row,status:'published'},{...row,version:0},{...row,version:2.5}])
  assert.throws(()=>missionIssueDecisionArgs('company-A',bad,'resume','Motif valable',request),/invalide/);
 assert.throws(()=>missionIssueDecisionArgs('company-A',row,'finish','Motif valable',request));
 assert.throws(()=>missionIssueDecisionArgs('company-A',row,'cancel','Non',request));
 assert.throws(()=>missionIssueDecisionArgs('company-A',row,'cancel','Motif valide','not-uuid'));
 assert.equal(issueDecisionLabel('resume'),'Mission remise à faire');
 assert.equal(issueDecisionLabel('cancel'),'Mission annulée après examen');
});
function setup(){
 const w=new Window();w.confirm=()=>true;w.crypto.randomUUID=()=>request;
 const list=[{...row}],calls=[],notices=[];let fail=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true}};
  if(name==='list_essential_client_sites')return {data:{items:[{id:'site-one',name:'Site client',active:true}]}};
  if(name==='list_essential_missions')return {data:{enabled:true,items:list.filter(m=>m.mission_day===args.p_day&&(args.p_include_drafts||m.worker_id===args.p_worker)&& (args.p_include_drafts || ['published','completed','impossible'].includes(m.status)||(m.status==='cancelled'&&m.issue_decision==='cancel'))).map(m=>({...m,issue_note:args.p_include_drafts?m.issue_note:null})),truncated:false}};
  if(name==='resolve_essential_mission_issue'){
   if(fail)return {error:{message:'Réseau indisponible'}};
   const m=list.find(m=>m.id===args.p_mission && m.company_id===args.p_company);
   if(!m||m.version!==args.p_version||m.status!=='impossible')return {error:{message:'Version modifiée'}};
   m.version++;m.status=args.p_decision==='resume'?'published':'cancelled';
   m.issue_decision=args.p_decision;m.issue_decision_reason=args.p_reason;m.issue_decision_at='2026-10-27T10:00:00Z';
   m.issue_reason=null;m.issue_note=null;
   notices.push(m.worker_id);
   return {data:{id:m.id,version:m.version,status:m.status}};
  }
  throw Error('Unexpected '+name);
 }};
 return {w,list,calls,notices,sb,setFail:x=>{fail=x}};
}
async function runDecision(decision){
 const fx=setup(),manager=createMissionManager({sb:fx.sb,document:fx.w.document,redraw(){},notify(){},escape:esc});
 await manager.load('company-A',[{id:'worker-one',name:'Nadine',status:'active'}]);
 let html=manager.render();assert.match(html,/Traiter le signalement/);assert.match(html,/Étage privé/);
 await manager.handle('decision-open',{dataset:{id:row.id}});
 fx.w.document.body.innerHTML=manager.render();
 assert.ok(fx.w.document.getElementById('mission-decision-action-'+row.id));
 fx.w.document.getElementById('mission-decision-action-'+row.id).value=decision;
 fx.w.document.getElementById('mission-decision-reason-'+row.id).value='Décision communiquée au salarié';
 await manager.handle('decision-submit',{dataset:{id:row.id}});
 assert.equal(manager.state.error,'');
 assert.equal(fx.notices.length,1);
 assert.equal(fx.list[0].status,decision==='resume'?'published':'cancelled');
 const calls=fx.calls.filter(x=>x.name==='resolve_essential_mission_issue');
 assert.equal(calls.length,1);assert.equal(calls[0].args.p_version,2);
 assert.equal(calls[0].args.p_decision,decision);
 assert.equal(fx.calls.some(x=>/punch|scheduled_shift|payroll|gps|mileage/.test(x.name)),false);
 const employee=createPersonalMissionController({sb:fx.sb,document:fx.w.document,redraw(){},notify(){},escape:esc});
 await employee.load('company-A','employee-one','worker-one',day);
 assert.match(employee.render(),/Décision du responsable/);
 assert.match(employee.render(),/Décision communiquée au salarié/);
 assert.ok(!employee.render().includes('Étage privé'));
 assert.equal(resolvedMissionNotice(fx.list[0]).includes('Décision communiquée'),true);
 await fx.w.happyDOM.close();
}
test('manager resumes signaled mission; employee receives same-tenant decision',()=>runDecision('resume'));
test('manager cancels signaled mission; employee sees cancellation even without active route',()=>runDecision('cancel'));
test('failed resolution keeps issue and request identity available for retry',async()=>{
 const fx=setup(),m=createMissionManager({sb:fx.sb,document:fx.w.document,redraw(){},notify(){},escape:esc});
 await m.load('company-A',[{id:'worker-one',name:'Nadine',status:'active'}]);
 await m.handle('decision-open',{dataset:{id:row.id}});
 fx.w.document.body.innerHTML=m.render();
 fx.w.document.getElementById('mission-decision-action-'+row.id).value='cancel';
 fx.w.document.getElementById('mission-decision-reason-'+row.id).value='Réinspection du dossier nécessaire';
 fx.setFail(true);
 await m.handle('decision-submit',{dataset:{id:row.id}});
 assert.match(m.state.error,/Réseau indisponible/);
 assert.equal(fx.list[0].status,'impossible');assert.equal(m.state.decisionId,row.id);
 fx.setFail(false);
 await m.handle('decision-submit',{dataset:{id:row.id}});
 assert.equal(fx.list[0].status,'cancelled');
 const requests=fx.calls.filter(x=>x.name==='resolve_essential_mission_issue');
 assert.equal(requests.length,2);assert.equal(requests[0].args.p_request,requests[1].args.p_request);
 await fx.w.happyDOM.close();
});
