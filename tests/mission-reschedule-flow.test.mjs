import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';
import {missionRescheduleArgs} from '../web/live/mission-reschedule.js';
const e=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const today=missionDate();
const tomorrow=new Date(new Date(today+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
function fixture(){
 const win=new Window();win.confirm=()=>true;
 const locations=[
  {id:'site-1',active:true,name:'Bureau',client_name:'Clinique',city:'Québec'},
  {id:'site-2',active:true,name:'Magasin',client_name:'Client B',city:'Charlesbourg'}];
 const rows=[{id:'mission-1',company_id:'company-1',worker_id:'worker-1',mission_day:today,site_id:'site-1',
  status:'published',version:2,sort_order:1,title:'Nettoyage',client_name:'Clinique',site_name:'Bureau',
  address_line:'123 rue du Centre',city:'Québec'}];
 const calls=[],notifications=[],idempotent=new Map();let outage=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true}};
  if(name==='list_essential_client_sites')return {data:{items:locations}};
  if(name==='list_essential_missions')return {data:{enabled:true,truncated:false,items:rows.filter(x=>x.mission_day===args.p_day&&(!args.p_worker||x.worker_id===args.p_worker))}};
  if(name==='reschedule_essential_published_mission'){
   if(outage)return {error:{message:'Réseau inaccessible'}};
   const key=args.p_company+':'+args.p_id+':'+args.p_request;
   if(idempotent.has(key))return {data:{...idempotent.get(key),duplicate:true}};
   const row=rows.find(x=>x.id===args.p_id&&x.company_id===args.p_company);
   if(!row||row.status!=='published'||row.version!==args.p_version)return {error:{message:'Conflit de version'}};
   if(!locations.some(x=>x.id===args.p_target_site&&x.active))return {error:{message:'Site interdit'}};
   if(rows.some(x=>x!==row&&x.worker_id===row.worker_id&&x.mission_day===args.p_target_day&&
    x.sort_order===args.p_target_order&&['published','completed'].includes(x.status)))return {error:{message:'Rang déjà occupé'}};
   Object.assign(row,{mission_day:args.p_target_day,site_id:args.p_target_site,sort_order:args.p_target_order,version:row.version+1,
    site_name:'Magasin',client_name:'Client B',address_line:'456 chemin B',city:'Charlesbourg'});
   notifications.push(row.worker_id);
   const result={id:row.id,version:row.version,status:row.status};idempotent.set(key,result);return {data:result};
  }
  throw Error('Unexpected RPC: '+name);
 }};
 return {win,rows,locations,sb,calls,notifications,setOutage:x=>outage=x};
}
function form(fx,ui,{day=tomorrow,site='site-2',order='3',reason='Client déplacé à une autre date'}={}){
 fx.win.document.body.innerHTML=ui.render();
 const id='mission-1';
 fx.win.document.getElementById('mission-reschedule-day-'+id).value=day;
 fx.win.document.getElementById('mission-reschedule-site-'+id).value=site;
 fx.win.document.getElementById('mission-reschedule-order-'+id).value=order;
 fx.win.document.getElementById('mission-reschedule-reason-'+id).value=reason;
}
test('Boss reprograms published mission on Web, employee old day loses it and new day gains it without punch',async()=>{
 const fx=fixture(),ui=createMissionManager({sb:fx.sb,document:fx.win.document,escape:e,redraw(){},notify(){}});
 await ui.load('company-1',[{id:'worker-1',status:'active',name:'Nadine'}]);
 fx.win.document.body.innerHTML=ui.render();
 assert.match(fx.win.document.body.textContent,/Reprogrammer jour, lieu ou rang/);
 await ui.handle('reschedule-open',{dataset:{id:'mission-1'}});
 form(fx,ui);
 await ui.handle('reschedule-submit',{dataset:{id:'mission-1'}});
 assert.equal(ui.state.error,'');
 assert.equal(fx.rows[0].mission_day,tomorrow);
 assert.equal(fx.rows[0].sort_order,3);
 assert.equal(fx.rows[0].site_id,'site-2');
 assert.equal(fx.rows[0].worker_id,'worker-1');
 assert.deepEqual(fx.notifications,['worker-1']);
 const old=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:e,redraw(){},notify(){}});
 await old.load('company-1','user-1','worker-1',today);assert.equal(old.render(),'');
 const next=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:e,redraw(){},notify(){}});
 await next.load('company-1','user-1','worker-1',tomorrow);
 assert.match(next.render(),/Charlesbourg/);
 assert.equal(fx.calls.filter(x=>/punch|payroll|gps|shift/.test(x.name)).length,0);
 await fx.win.happyDOM.close();
});
test('Failed request keeps the same idempotency key on retry and does not claim success early',async()=>{
 const fx=fixture(),ui=createMissionManager({sb:fx.sb,document:fx.win.document,escape:e,redraw(){},notify(){}});
 await ui.load('company-1',[{id:'worker-1',status:'active',name:'Nadine'}]);
 await ui.handle('reschedule-open',{dataset:{id:'mission-1'}});
 form(fx,ui);fx.setOutage(true);
 await ui.handle('reschedule-submit',{dataset:{id:'mission-1'}});
 assert.match(ui.state.error,/Réseau inaccessible/);assert.equal(fx.rows[0].mission_day,today);
 fx.setOutage(false);await ui.handle('reschedule-submit',{dataset:{id:'mission-1'}});
 const requests=fx.calls.filter(x=>x.name==='reschedule_essential_published_mission');
 assert.equal(requests.length,2);assert.equal(requests[0].args.p_request,requests[1].args.p_request);
 assert.equal(fx.notifications.length,1);assert.equal(fx.rows[0].mission_day,tomorrow);
 await fx.win.happyDOM.close();
});
test('Published-only guards reject impossible dates, no-op, inactive inputs, bad ranks and reused request',()=>{
 const m={id:'m1',version:2,status:'published',mission_day:today,site_id:'site-1',sort_order:1};
 const request=crypto.randomUUID(),ok=missionRescheduleArgs('company',m,tomorrow,'site-2',2,'Justification valide',request);
 assert.equal(ok.p_target_day,tomorrow);assert.equal(ok.p_target_site,'site-2');
 for(const item of [
  ['2026-02-31','site-2',2,'Justification valide'],
  [tomorrow,'',2,'Justification valide'],
  [tomorrow,'site-2',1000,'Justification valide'],
  [tomorrow,'site-2',2,'x'],
  [today,'site-1',1,'Justification valide']])
  assert.throws(()=>missionRescheduleArgs('company',m,...item,request),/invalide/);
 assert.throws(()=>missionRescheduleArgs('company',{...m,status:'completed'},tomorrow,'site-2',2,'Justification valide',request),/invalide/);
 assert.throws(()=>missionRescheduleArgs('company',{...m,version:0},tomorrow,'site-2',2,'Justification valide',request),/invalide/);
 assert.throws(()=>missionRescheduleArgs('company',m,tomorrow,'site-2',2,'Justification valide','not-uuid'),/invalide/);
});
