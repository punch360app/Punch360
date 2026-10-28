import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,missionDate} from '../web/live/missions.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=missionDate();
function fixture({revoked=false,conflict=false}={}){
 const win=new Window();win.confirm=()=>true;
 const writes=[],requests=[],notices=[],roster=[{id:'worker-A',name:'Nadine',status:'active'}];
 const sites=[{id:'site-A',name:'Bureau',client_name:'Clinique',city:'Québec',active:true}];
 const sb={
  auth:{async getUser(){return revoked?{error:{message:'revoked'},data:{user:null}}:
   {error:null,data:{user:{id:'boss-A'}}}}},
  async rpc(name,args){requests.push({name,args});
   if(name==='essential_missions_configuration')return{data:{enabled:true}};
   if(name==='list_essential_client_sites')return{data:{items:sites,has_more:false}};
   if(name==='list_essential_missions')return{data:{enabled:true,truncated:false,
    items:[...writes.filter(x=>x.mission_day===args.p_day),
     ...(conflict?[{id:'existing',mission_day:args.p_day,worker_id:'worker-A',site_id:'site-A',
      sort_order:1,status:'published',title:'Autre mission'}]:[])]}};
   if(name==='save_essential_mission'){
    const row={id:'mission-'+(writes.length+1),mission_day:args.p_day,worker_id:args.p_worker,
     site_id:args.p_site,sort_order:args.p_order,title:args.p_title,status:'draft'};
    writes.push(row);return{data:{id:row.id,version:1,status:'draft'}};
   }
   throw Error('Unexpected '+name);
  }};
 const manager=createMissionManager({sb,document:win.document,escape:esc,redraw(){},notify:x=>notices.push(x)});
 function fill(){
  win.document.body.innerHTML=manager.render();
  const set=(id,value)=>{const el=win.document.getElementById('mission-'+id);
   assert.ok(el,'missing '+id);el.value=String(value);};
  set('worker','worker-A');set('site','site-A');set('day',day);set('order',1);
  set('title','Nettoyage récurrent');set('instructions','Tâche simple');
  set('recurrence-weeks','1');set('recurrence-count','4');
 }
 return {win,manager,writes,requests,notices,roster,fill};
}
test('manager previews 4 weekly dates with zero server writes, then saves drafts only',async()=>{
 const x=fixture();await x.manager.load('company-A',x.roster);x.fill();
 await x.manager.handle('recurrence-preview',{dataset:{}});
 assert.equal(x.writes.length,0);assert.equal(x.manager.state.recurrencePreview.rows.length,4);
 assert.match(x.manager.render(),/Créer ces brouillons/);
 await x.manager.handle('recurrence-confirm',{dataset:{}});
 assert.equal(x.writes.length,4);
 assert.equal(new Set(x.writes.map(m=>m.mission_day)).size,4);
 assert.equal(x.requests.filter(x=>x.name==='save_essential_mission').length,4);
 assert.ok(x.requests.filter(x=>x.name==='save_essential_mission').every(x=>x.args.p_publish===false));
 assert.match(x.notices.join(' '),/4 brouillon/);
 await x.win.happyDOM.close();
});
test('server duplicate on any recurrence date blocks the entire batch',async()=>{
 const x=fixture({conflict:true});await x.manager.load('company-A',x.roster);x.fill();
 await x.manager.handle('recurrence-preview',{dataset:{}});
 await x.manager.handle('recurrence-confirm',{dataset:{}});
 assert.equal(x.writes.length,0);
 assert.match(x.manager.state.error,/Rang déjà occupé|récurrence refusée|Récurrence interrompue/);
 await x.win.happyDOM.close();
});
test('revoked Auth cannot schedule any recurrence even from valid preview',async()=>{
 const x=fixture({revoked:true});await x.manager.load('company-A',x.roster);x.fill();
 await x.manager.handle('recurrence-preview',{dataset:{}});
 await x.manager.handle('recurrence-confirm',{dataset:{}});
 assert.equal(x.writes.length,0);
 assert.match(x.manager.state.error,/Session expirée/);
 await x.win.happyDOM.close();
});
test('refreshing a manager context discards pending recurrence preview',async()=>{
 const x=fixture();await x.manager.load('company-A',x.roster);x.fill();
 await x.manager.handle('recurrence-preview',{dataset:{}});
 await x.manager.load('company-B',x.roster);
 assert.equal(x.manager.state.recurrencePreview,null);
 await x.manager.handle('recurrence-confirm',{dataset:{}});
 assert.equal(x.writes.length,0);
 await x.win.happyDOM.close();
});
