import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionProgress,personalMissionTour,missionDate} from '../web/live/missions.js';
import {missionIssueArgs} from '../web/live/mission-issues.js';
import {missionDayReview} from '../web/live/mission-day-review.js';
const date=missionDate(),request='802bb8a6-cd04-435d-9fcb-3ec713f57e42';
const mission={id:'mission-a',company_id:'tenant-A',worker_id:'worker-A',version:1,status:'published',
 mission_day:date,sort_order:1,title:'Inspection',client_name:'Client A',site_name:'Entrée A',
 address_line:'11 rue des Lilas',city:'Québec',country:'CA'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('started mission has explicit state and remains next until employee finishes or reports it',()=>{
 const rows=[{...mission,status:'in_progress'}, {...mission,id:'other',sort_order:2,status:'published'}];
 const p=missionProgress(rows);assert.equal(p.next.id,'mission-a');
 assert.equal(p.total,2);assert.equal(p.allDone,false);
 assert.equal(personalMissionTour(rows,'worker-A',25,date).rows.length,2);
 assert.equal(missionDayReview(rows).counts.in_progress,1);
 assert.equal(missionIssueArgs('tenant-A',{...mission,status:'in_progress'},'client_absent','Non présent',request).p_reason,'client_absent');
});
function fixture(){
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=>request;
 const list=[{...mission},{...mission,id:'mission-b',sort_order:2}],calls=[],journal=[];
 let failStart=false,failFinish=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='list_essential_missions')return{data:{enabled:true,items:list.filter(m=>m.mission_day===args.p_day&&m.worker_id===args.p_worker).map(m=>({...m})),truncated:false}};
  const m=list.find(m=>m.id===args.p_mission||m.id===args.p_id);
  if(name==='start_essential_mission'){
   if(failStart)return{error:{message:'Réseau indisponible'}};
   if(args.p_company!=='tenant-A'||!m||m.status!=='published'||m.version!==args.p_version)return{error:{message:'Version ou compagnie refusée'}};
   if(list.some(x=>x.status==='in_progress'&&x.id!==m.id))return {error:{message:'Mission déjà en cours'}};
   m.status='in_progress';m.version++;journal.push('start:'+m.id);
   return {data:{id:m.id,status:m.status,version:m.version}};
  }
  if(name==='complete_essential_mission'){
   if(failFinish)return{error:{message:'Perte de réseau'}};
   if(!m||!['published','in_progress'].includes(m.status)||m.version!==args.p_version)return {error:{message:'Version refusée'}};
   m.status='completed';m.version++;journal.push('complete:'+m.id);
   return {data:{id:m.id,status:m.status,version:m.version}};
  }
  if(name==='report_essential_mission_issue'){
   if(!m||!['published','in_progress'].includes(m.status)||m.version!==args.p_version)return {error:{message:'Version refusée'}};
   m.status='impossible';m.version++;journal.push('issue:'+m.id);return{data:{id:m.id,status:m.status,version:m.version}};
  }
  throw Error('Unexpected RPC '+name);
 }};
 return {win,sb,list,calls,journal,setFailStart:v=>{failStart=v},setFailFinish:v=>{failFinish=v}};
}
test('employee starts published mission, resumes it as current and then finishes without clock actions',async()=>{
 const fx=fixture(),c=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await c.load('tenant-A','user-A','worker-A',date);
 assert.match(c.render(),/Commencer cette mission/);
 assert.equal(await c.start('mission-a'),true);
 assert.match(c.render(),/Mission en cours/);
 assert.doesNotMatch(c.render(),/data-action="mission:start"/);
 assert.equal(c.state.items[0].version,2);
 assert.equal(await c.finish('mission-a'),true);
 assert.equal(fx.list[0].status,'completed');
 assert.equal(c.state.items[0].status,'completed');
 assert.deepEqual(fx.journal,['start:mission-a','complete:mission-a']);
 assert.equal(fx.calls.some(x=>/punch|shift|payroll|gps/i.test(x.name)),false);
 await fx.win.happyDOM.close();
});
test('start network failure reuses the same idempotency request on explicit retry',async()=>{
 const fx=fixture(),c=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await c.load('tenant-A','user-A','worker-A',date);
 fx.setFailStart(true);
 assert.equal(await c.start('mission-a'),false);
 assert.equal(fx.list[0].status,'published');
 fx.setFailStart(false);
 assert.equal(await c.start('mission-a'),true);
 const attempts=fx.calls.filter(x=>x.name==='start_essential_mission');
 assert.equal(attempts.length,2);
 assert.equal(attempts[0].args.p_request,attempts[1].args.p_request);
 await fx.win.happyDOM.close();
});
test('in-progress mission can be reported impossible; no second mission auto-starts',async()=>{
 const fx=fixture(),c=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await c.load('tenant-A','user-A','worker-A',date);
 await c.start('mission-a');
 await c.handleIssue('issue-open','mission-a');
 fx.win.document.body.innerHTML=c.render();
 fx.win.document.getElementById('mission-issue-reason').value='access_blocked';
 fx.win.document.getElementById('mission-issue-note').value='Accès fermé';
 assert.equal(await c.handleIssue('issue-submit','mission-a'),true);
 assert.equal(fx.list[0].status,'impossible');
 assert.equal(fx.list[1].status,'published');
 assert.equal(fx.journal.includes('start:mission-b'),false);
 await fx.win.happyDOM.close();
});
