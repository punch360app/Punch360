import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';
import {missionReassignArgs} from '../web/live/mission-reassign.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[z]));
const day=missionDate();
function fixture(){
 const window=new Window();window.confirm=()=>true;
 const workers=[{id:'worker-a',name:'Nadine',status:'active'},{id:'worker-b',name:'Mathieu',status:'active'}];
 const list=[{id:'first',version:1,worker_id:'worker-a',sort_order:1,status:'published',mission_day:day,title:'Nettoyage',
  site_name:'Maison',client_name:'Client A',address_line:'123 rue A',city:'Québec'}];
 const calls=[],notices=[];let fail=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true}};
  if(name==='list_essential_client_sites')return {data:{items:[]}};
  if(name==='list_essential_missions')return {data:{enabled:true,items:list.filter(m=>!args.p_worker||m.worker_id===args.p_worker),truncated:false}};
  if(name==='reassign_essential_published_mission'){
   if(fail)return {error:{message:'Connexion indisponible'}};
   const m=list.find(x=>x.id===args.p_id);
   if(!m||m.version!==args.p_version||m.status!=='published')return {error:{message:'Conflit de version'}};
   if(list.some(x=>x!==m&&x.worker_id===args.p_target_worker&&x.sort_order===args.p_target_order&&['published','completed'].includes(x.status)))
    return {error:{message:'Ce rang est déjà occupé'}};
   notices.push(m.worker_id,args.p_target_worker);m.worker_id=args.p_target_worker;m.sort_order=args.p_target_order;m.version++;
   return {data:{id:m.id,worker_id:m.worker_id,version:m.version,status:m.status,duplicate:false}};
  }
  throw Error(name);
 }};
 return {window,list,workers,sb,calls,notices,setFail:x=>{fail=x}};
}
test('Boss moves published mission from Nadine to Mathieu, and only Mathieu sees it',async()=>{
 const fx=fixture(),ui=createMissionManager({sb:fx.sb,document:fx.window.document,escape,redraw(){},notify(){}});
 await ui.load('company',fx.workers);
 fx.window.document.body.innerHTML=ui.render();
 assert.match(fx.window.document.body.textContent,/Réaffecter à un autre salarié/);
 await ui.handle('reassign-open',{dataset:{id:'first'}});
 fx.window.document.body.innerHTML=ui.render();
 fx.window.document.getElementById('mission-reassign-worker-first').value='worker-b';
 fx.window.document.getElementById('mission-reassign-order-first').value='2';
 fx.window.document.getElementById('mission-reassign-reason-first').value='Répartition après absence imprévue';
 await ui.handle('reassign-submit',{dataset:{id:'first'}});
 assert.equal(ui.state.error,'');
 assert.equal(fx.list[0].worker_id,'worker-b');assert.equal(fx.list[0].sort_order,2);
 assert.deepEqual(fx.notices,['worker-a','worker-b']);
 assert.equal(fx.calls.filter(c=>/punch|payroll|scheduled_shift|gps/.test(c.name)).length,0);
 const old=createPersonalMissionController({sb:fx.sb,document:fx.window.document,escape,redraw(){},notify(){}});
 await old.load('company','user-a','worker-a',day);assert.match(old.render(),/Aucune mission pour aujourd’hui/);assert.doesNotMatch(old.render(),/Nettoyage/);
 const newer=createPersonalMissionController({sb:fx.sb,document:fx.window.document,escape,redraw(){},notify(){}});
 await newer.load('company','user-b','worker-b',day);assert.match(newer.render(),/Nettoyage/);
 await fx.window.happyDOM.close();
});
test('network failure retries same idempotency key with same target; never reports a failed reassignment as success',async()=>{
 const fx=fixture(),ui=createMissionManager({sb:fx.sb,document:fx.window.document,escape,redraw(){},notify(){}});
 await ui.load('company',fx.workers);await ui.handle('reassign-open',{dataset:{id:'first'}});
 fx.window.document.body.innerHTML=ui.render();
 fx.window.document.getElementById('mission-reassign-worker-first').value='worker-b';
 fx.window.document.getElementById('mission-reassign-order-first').value='2';
 fx.window.document.getElementById('mission-reassign-reason-first').value='Remplacement autorisé';
 fx.setFail(true);await ui.handle('reassign-submit',{dataset:{id:'first'}});
 assert.match(ui.state.error,/Connexion/);assert.equal(fx.list[0].worker_id,'worker-a');
 fx.setFail(false);await ui.handle('reassign-submit',{dataset:{id:'first'}});
 const calls=fx.calls.filter(x=>x.name==='reassign_essential_published_mission');
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_request,calls[1].args.p_request);
 assert.equal(fx.list[0].worker_id,'worker-b');assert.equal(fx.notices.length,2);
 await fx.window.happyDOM.close();
});
test('role-related client guards reject same worker, completed, invalid version and order',()=>{
 const m={id:'m',status:'published',version:2,worker_id:'worker-a'};
 assert.throws(()=>missionReassignArgs('c',m,'worker-a',2,'Motif autorisé',crypto.randomUUID()),/invalide/);
 assert.throws(()=>missionReassignArgs('c',{...m,status:'completed'},'worker-b',2,'Motif autorisé',crypto.randomUUID()),/invalide/);
 assert.throws(()=>missionReassignArgs('c',m,'worker-b',1000,'Motif autorisé',crypto.randomUUID()),/invalide/);
 assert.throws(()=>missionReassignArgs('c',m,'worker-b',2,'x',crypto.randomUUID()),/invalide/);
 assert.equal(missionReassignArgs('c',m,'worker-b','7','  Remplacement manuel  ',crypto.randomUUID()).p_target_order,7);
});
