import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionDate,missionProgress,personalMissionTour,createMissionManager} from '../web/live/missions.js';
import {missionIssueArgs,missionIssueLabel,missionIssueState} from '../web/live/mission-issues.js';
import {missionDayReview,missionDayReviewCsv} from '../web/live/mission-day-review.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[z]));
const day=missionDate();
function setup(){
 const win=new Window();win.confirm=()=>true;
 const calls=[],rows=[{id:'m1',company_id:'company',worker_id:'worker',mission_day:day,status:'published',version:1,sort_order:1,title:'Nettoyer',client_name:'Client A',site_name:'Site A',address_line:'123 rue du Port',city:'Québec'}];
 let fail=false,enabled=true;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='list_essential_missions')return {data:{enabled,items:rows.filter(x=>x.worker_id===args.p_worker||args.p_worker===null),truncated:false}};
  if(name==='report_essential_mission_issue'){
   if(fail)return {error:{message:'Connexion'}};
   const m=rows.find(x=>x.id===args.p_mission);
   if(!m||m.status!=='published'||m.version!==args.p_version)return {error:{message:'Conflit de version'}};
   m.status='impossible';m.version++;m.issue_reason=args.p_reason;m.issue_note=args.p_note;
   return {data:{id:m.id,version:m.version,status:'impossible',duplicate:false}};
  }
  if(name==='essential_missions_configuration')return {data:{enabled}};
  if(name==='list_essential_client_sites')return {data:{items:[]}};
  throw Error(name);
 }};
 return {win,calls,rows,sb,setFail:x=>{fail=x}};
}
test('report a mission impossible explicitly, preserve hours and expose only a safe label to worker',async()=>{
 const fx=setup();const ctrl=createPersonalMissionController({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape});
 await ctrl.load('company','user','worker',day);
 assert.match(ctrl.render(),/Signaler une mission impossible/);
 assert.equal(await ctrl.handleIssue('issue-open','m1'),true);
 fx.win.document.body.innerHTML=ctrl.render();
 fx.win.document.getElementById('mission-issue-reason').value='client_absent';
 fx.win.document.getElementById('mission-issue-note').value='Client absent, code 999 secret';
 assert.equal(await ctrl.handleIssue('issue-submit','m1'),true);
 assert.equal(fx.rows[0].status,'impossible');
 assert.match(ctrl.render(),/Mission signalée au responsable/);
 assert.match(ctrl.render(),/Client absent/);
 assert.doesNotMatch(ctrl.render(),/code 999 secret/);
 assert.equal(ctrl.state.issue,null);
 assert.equal(missionProgress(fx.rows).blocked,1);
 assert.equal(personalMissionTour(fx.rows,'worker',25,day).rows[0].status,'impossible');
 assert.equal(fx.calls.filter(x=>x.name==='report_essential_mission_issue').length,1);
 assert.equal(fx.calls.some(x=>/punch|payroll|scheduled_shift|location_event/.test(x.name)),false);
 await fx.win.happyDOM.close();
});
test('network failure reuses the exact request ID and never labels a failed report confirmed',async()=>{
 const fx=setup();const ctrl=createPersonalMissionController({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape});
 await ctrl.load('company','user','worker',day);
 await ctrl.handleIssue('issue-open','m1');
 fx.win.document.body.innerHTML=ctrl.render();
 fx.win.document.getElementById('mission-issue-reason').value='access_blocked';
 fx.setFail(true);assert.equal(await ctrl.handleIssue('issue-submit','m1'),false);
 assert.equal(fx.rows[0].status,'published');assert.match(ctrl.render(),/non confirmé/);
 fx.win.document.body.innerHTML=ctrl.render();fx.setFail(false);
 assert.equal(await ctrl.handleIssue('issue-submit','m1'),true);
 const calls=fx.calls.filter(x=>x.name==='report_essential_mission_issue');
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_request,calls[1].args.p_request);
 await fx.win.happyDOM.close();
});
test('client-side restrictions reject invalid reason, stale versions and isolate tenant state',async()=>{
 assert.throws(()=>missionIssueArgs('c',{id:'m',version:1,status:'completed'},'other',null,crypto.randomUUID()),/invalide/);
 assert.throws(()=>missionIssueArgs('c',{id:'m',version:1,status:'published'},'other','x'.repeat(301),crypto.randomUUID()),/invalide/);
 assert.equal(missionIssueLabel('wrong_address'),'Mauvaise adresse');
 const fx=setup();const ctrl=createPersonalMissionController({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape});
 await ctrl.load('company','user','worker',day);await ctrl.handleIssue('issue-open','m1');
 assert.equal(ctrl.state.issue.id,'m1');
 await ctrl.load('another-company','user','worker',day);
 assert.equal(ctrl.state.issue,null);assert.equal(ctrl.state.pending.size,0);
 await fx.win.happyDOM.close();
});
test('manager report and CSV include only authorized reason code, not private note',async()=>{
 const fx=setup();fx.rows[0].status='impossible';fx.rows[0].issue_reason='wrong_address';fx.rows[0].issue_note='Code secret porte 9876';
 const report=missionDayReview(fx.rows);
 assert.equal(report.counts.impossible,1);
 const csv=missionDayReviewCsv(report,day);
 assert.match(csv,/Mauvaise adresse/);assert.doesNotMatch(csv,/Code secret porte/);
 const manager=createMissionManager({sb:fx.sb,document:fx.win.document,escape,redraw(){},notify(){}});
 await manager.load('company',[{id:'worker',name:'Employé',status:'active'}]);
 assert.match(manager.render(),/Code secret porte 9876/);
 assert.match(manager.render(),/À traiter : 1/);
 await fx.win.happyDOM.close();
});
