import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {missionPostponeArgs} from '../web/live/mission-postpone.js';
import {issueDecisionLabel,resolvedMissionNotice} from '../web/live/mission-issue-decision.js';
import {missionDayReview,missionDayReviewCsv} from '../web/live/mission-day-review.js';
import {createMissionManager,createPersonalMissionController,missionProgress} from '../web/live/missions.js';
const today=new Date().toISOString().slice(0,10);
const later=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
const request='a381acdd-8d15-44fe-94e0-3729918af505';
const issue={id:'mission-A',status:'impossible',version:2,company_id:'tenant',worker_id:'worker-A',
 mission_day:today,sort_order:1,title:'Visite déplacée',site_name:'Entrée B',client_name:'Client A',
 first_name:'Alex',last_name:'',issue_reason:'client_absent',issue_note:'Code secret',site_id:'site-A'};
test('postponement validates new day, rank, reason and impossible version',()=>{
 const a=missionPostponeArgs('tenant',issue,later,2,'Nouvelle disponibilité du client',request);
 assert.deepEqual(a,{p_company:'tenant',p_mission:issue.id,p_version:2,p_request:request,
  p_day:later,p_order:2,p_reason:'Nouvelle disponibilité du client'});
 for(const [day,rank] of [[today,1],['2026-99-77',2],[later,0],[later,1000]])
  assert.throws(()=>missionPostponeArgs('tenant',issue,day,rank,'Report accepté par le client',request));
 assert.throws(()=>missionPostponeArgs('tenant',{...issue,status:'completed'},later,1,'Report accepté par le client',request));
 assert.equal(issueDecisionLabel('postpone'),'Mission reportée');
});
test('manager review and CSV label historical postponed mission without counting it as due',()=>{
 const entry={...issue,status:'postponed',issue_decision:'postpone',issue_decision_reason:'Nouveau jour accepté',
 issue_decision_at:'2026-10-27T12:00:00Z',issue_postponed_from:today,mission_day:later};
 const report=missionDayReview([entry]);
 assert.equal(report.counts.postponed,1);
 assert.equal(report.counts.published,0);
 assert.equal(report.visible[0].status,'postponed');
 assert.match(missionDayReviewCsv(report,today),/Reportée/);
 assert.equal(missionProgress([entry]).total,0,'old date has no navigable task');
 assert.match(resolvedMissionNotice(entry),new RegExp(later));
});
const escape=x=>String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
test('manager postpones once, worker sees old-day result and future route',async()=>{
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=>request;
 const mission={...issue},calls=[],alerts=[];let enabled=true;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled}};
  if(name==='list_essential_client_sites')return {data:{items:[{id:'site-A',name:'Entrée B',active:true}]}};
  if(name==='list_essential_missions'){
   const day=args.p_day;
   const isOriginal=mission.issue_postponed_from===day;
   const shown=mission.mission_day===day||isOriginal;
   const m={...mission,status:isOriginal?'postponed':mission.status,issue_note:args.p_include_drafts?mission.issue_note:null};
   return {data:{enabled:true,items:shown?[m]:[],truncated:false}};
  }
  if(name==='postpone_essential_mission_issue'){
   if(mission.status!=='impossible'||mission.version!==args.p_version)return {error:{message:'Mission modifiée'}};
   mission.issue_postponed_from=mission.mission_day;
   mission.mission_day=args.p_day;mission.sort_order=args.p_order;mission.status='published';mission.version++;
   mission.issue_decision='postpone';mission.issue_decision_at='2026-10-27T12:00:00Z';
   mission.issue_decision_reason=args.p_reason;mission.issue_note=null;mission.issue_reason=null;
   alerts.push(mission.worker_id);
   return {data:{status:'published',new_day:mission.mission_day,version:mission.version}};
  }
  throw Error('Unexpected '+name);
 }};
 const manager=createMissionManager({sb,document:win.document,escape,redraw(){},notify(){}});
 await manager.load('tenant',[{id:'worker-A',name:'Alex',status:'active'}]);
 assert.match(manager.render(),/Reporter à une autre journée/);
 await manager.handle('postpone-open',{dataset:{id:issue.id}});
 win.document.body.innerHTML=manager.render();
 win.document.getElementById('mission-postpone-day-'+issue.id).value=later;
 win.document.getElementById('mission-postpone-order-'+issue.id).value='2';
 win.document.getElementById('mission-postpone-reason-'+issue.id).value='Accord du client pour demain';
 await manager.handle('postpone-submit',{dataset:{id:issue.id}});
 assert.equal(manager.state.error,'');
 assert.equal(mission.mission_day,later);
 assert.deepEqual(alerts,['worker-A']);
 const worker=createPersonalMissionController({sb,document:win.document,escape,redraw(){},notify(){}});
 await worker.load('tenant','worker-user','worker-A',today);
 assert.match(worker.render(),/Mission reportée/);
 assert.match(worker.render(),new RegExp(later));
 assert.doesNotMatch(worker.render(),/Prochaine mission · 1 de 1/);
 await worker.load('tenant','worker-user','worker-A',later);
 assert.match(worker.render(),/Prochaine mission/);
 assert.match(worker.render(),/Accord du client pour demain/);
 assert.equal(calls.filter(c=>c.name==='postpone_essential_mission_issue').length,1);
 assert.equal(calls.some(c=>/punch|scheduled_shift|payroll|gps/i.test(c.name)),false);
 await win.happyDOM.close();
});
