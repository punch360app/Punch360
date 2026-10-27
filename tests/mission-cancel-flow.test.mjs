import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';
import {missionCancelArgs} from '../web/live/mission-cancel.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[z]));
const day=missionDate();
function fixture(){
 const window=new Window();window.confirm=()=>true;
 const list=[{id:'first',version:1,status:'published',sort_order:1,worker_id:'worker',mission_day:day,title:'Nettoyage',client_name:'Client A',site_name:'A'},
 {id:'second',version:1,status:'published',sort_order:2,worker_id:'worker',mission_day:day,title:'Vérification',client_name:'Client A',site_name:'B'}];
 const calls=[],notifications=[];let fail=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true}};
  if(name==='list_essential_client_sites')return {data:{items:[]}};
  if(name==='list_essential_missions')return {data:{enabled:true,items:list.filter(m=>!args.p_worker||m.worker_id===args.p_worker).filter(m=>args.p_include_drafts||m.status!=='cancelled'),truncated:false}};
  if(name==='cancel_essential_published_mission'){
   if(fail)return {error:{message:'Connexion interrompue'}};
   const m=list.find(x=>x.id===args.p_id);
   if(!m||m.status!=='published'||m.version!==args.p_version)return {error:{message:'Mission modifiée'}};
   m.status='cancelled';m.version++;notifications.push(m.worker_id);
   return {data:{id:m.id,status:'cancelled',version:m.version}};
  }
  throw Error(name);
 }};
 return {window,list,calls,notifications,sb,setFail:x=>{fail=x}};
}
test('manager cancels published mission with reason, employee sees next without changing punch',async()=>{
 const f=fixture(),manager=createMissionManager({sb:f.sb,document:f.window.document,redraw(){},notify(){},escape:esc});
 await manager.load('company',[{id:'worker',name:'Nadine',status:'active'}]);
 f.window.document.body.innerHTML=manager.render();
 assert.match(f.window.document.body.textContent,/Annuler la mission publiée/);
 await manager.handle('cancel-open',{dataset:{id:'first'}});
 f.window.document.body.innerHTML=manager.render();
 f.window.document.getElementById('mission-cancel-reason-first').value='Le client a reporté la visite.';
 await manager.handle('cancel-submit',{dataset:{id:'first'}});
 assert.equal(manager.state.error,'');
 assert.equal(f.list[0].status,'cancelled');
 assert.equal(f.notifications.length,1);
 assert.equal(f.calls.filter(x=>x.name==='cancel_essential_published_mission').length,1);
 assert.equal(f.calls.filter(x=>/punch|payroll|scheduled_shift|gps/.test(x.name)).length,0);
 const person=createPersonalMissionController({sb:f.sb,document:f.window.document,redraw(){},notify(){},escape:esc});
 await person.load('company','user','worker',day);
 assert.match(person.render(),/Vérification/);
 assert.doesNotMatch(person.render(),/Nettoyage/);
 await f.window.happyDOM.close();
});
test('stale version and connection failures do not incorrectly say cancelled; retry keeps request ID',async()=>{
 const f=fixture(),manager=createMissionManager({sb:f.sb,document:f.window.document,redraw(){},notify(){},escape:esc});
 await manager.load('company',[{id:'worker',name:'Nadine',status:'active'}]);
 await manager.handle('cancel-open',{dataset:{id:'first'}});
 f.window.document.body.innerHTML=manager.render();
 f.window.document.getElementById('mission-cancel-reason-first').value='Le client a reporté la visite.';
 f.setFail(true);await manager.handle('cancel-submit',{dataset:{id:'first'}});
 assert.equal(f.list[0].status,'published');assert.match(manager.state.error,/Connexion/);
 f.setFail(false);await manager.handle('cancel-submit',{dataset:{id:'first'}});
 const attempts=f.calls.filter(x=>x.name==='cancel_essential_published_mission');
 assert.equal(attempts.length,2);assert.equal(attempts[0].args.p_request,attempts[1].args.p_request);
 assert.equal(f.notifications.length,1);
 await f.window.happyDOM.close();
});
test('client guard disallows cancelled, completed, missing reason or forged request',()=>{
 const m={id:'m',version:1,status:'published'};
 assert.throws(()=>missionCancelArgs('company',m,'x','not-a-uuid'),/invalide/);
 assert.throws(()=>missionCancelArgs('company',m,'abc',crypto.randomUUID()),/invalide/);
 assert.throws(()=>missionCancelArgs('company',{...m,status:'completed'},'Client absent',crypto.randomUUID()),/invalide/);
 assert.equal(missionCancelArgs('company',m,'  Client absent  ',crypto.randomUUID()).p_reason,'Client absent');
});
