import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionArgs,missionDate,missionProgress} from '../web/live/missions.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
function fixture(){
 const win=new Window();win.confirm=()=>true;
 const sites=[{id:'site-a',name:'Édifice A',client_name:'Clinique Nadine',city:'Québec',active:true}];
 const roster=[{id:'worker-a',name:'Nadine',status:'active'}],list=[],calls=[],notifications=[];
 let enabled=false,failFinish=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration'){
   if(args.p_enabled!==null){enabled=args.p_enabled;}return {data:{enabled}};
  }
  if(name==='list_essential_client_sites')return {data:{items:sites,has_more:false}};
  if(name==='list_essential_missions'){
   return {data:{enabled,items:!enabled?[]:list.filter(x=>x.mission_day===args.p_day&&
    (args.p_include_drafts||x.status==='published'||x.status==='completed')&&
    (!args.p_worker||x.worker_id===args.p_worker)).map(x=>({...x})),truncated:false}};
  }
  if(name==='save_essential_mission'){
   const existing=list.find(x=>x.id===args.p_id);
   if(existing&&existing.version!==args.p_version)return{error:{message:'Version obsolète'}};
   const data={id:existing?.id||'mission-'+(list.length+1),version:(existing?.version||0)+1,
    mission_day:args.p_day,worker_id:args.p_worker,site_id:args.p_site,
    title:args.p_title,sort_order:args.p_order,status:args.p_publish?'published':'draft',
    client_name:'Clinique Nadine',site_name:'Édifice A',address_line:'123 rue des Érables',
    city:'Québec',country:'CA',first_name:'Nadine'};
   if(existing)Object.assign(existing,data);else list.push(data);
   if(args.p_publish)notifications.push(args.p_worker);
   return {data:{id:data.id,version:data.version,status:data.status}};
  }
  if(name==='complete_essential_mission'){
   if(failFinish)return {error:{message:'Réseau indisponible'}};
   const entry=list.find(x=>x.id===args.p_id);
   if(!entry||entry.status!=='published')return{error:{message:'Déjà terminée'}};
   if(entry.version!==args.p_version)return{error:{message:'Version différente'}};
   entry.status='completed';entry.version++;return{data:{id:entry.id,version:entry.version,status:'completed'}};
  }
  throw Error('Unexpected API '+name);
 }};
 return {win,sb,sites,roster,list,calls,notifications,setFail:v=>{failFinish=v}};
}
const day=missionDate();
test('pure mission projection chooses next in explicit order and never confuses completion with punch exit',()=>{
 assert.deepEqual(missionProgress([]),{total:0,done:0,next:null,allDone:false});
 const rows=[{id:'b',sort_order:2,status:'published'},{id:'a',sort_order:1,status:'completed'},{id:'c',sort_order:3,status:'draft'}];
 const p=missionProgress(rows);assert.equal(p.total,2);assert.equal(p.done,1);assert.equal(p.next.id,'b');
 assert.equal(p.allDone,false);
 assert.equal(missionProgress([{id:'a',sort_order:1,status:'completed'}]).allDone,true);
 assert.throws(()=>missionArgs('company',{day,title:'Nettoyage',order:1,site:null,worker:'worker-a'}),/invalide/);
 assert.equal(missionArgs('company',{day,title:'Nettoyage',order:1,site:'site-a',worker:'worker-a'},null,true).p_publish,true);
});
test('manager explicit activation -> draft -> publish notifies one worker, never creates a shift or session',async()=>{
 const fx=fixture(),controller=createMissionManager({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape:esc});
 await controller.load('company',fx.roster);assert.match(controller.render(),/désactivé/);
 await controller.handle('toggle',{dataset:{}});assert.equal(controller.state.enabled,true);
 fx.win.document.body.innerHTML=controller.render();
 for(const [id,value] of Object.entries({day,worker:'worker-a',site:'site-a',order:'1',title:'Nettoyage',instructions:'Entrée de côté'})){
  fx.win.document.getElementById('mission-'+id).value=value;
 }
 await controller.handle('draft',{dataset:{}});
 assert.equal(fx.list.length,1);assert.equal(fx.list[0].status,'draft');assert.equal(fx.notifications.length,0);
 await controller.handle('edit',{dataset:{id:fx.list[0].id}});
 fx.win.document.body.innerHTML=controller.render();
 fx.win.document.getElementById('mission-title').value='Nettoyage vérifié';
 await controller.handle('publish',{dataset:{}});
 assert.equal(fx.list[0].status,'published');assert.equal(fx.list[0].title,'Nettoyage vérifié');
 assert.deepEqual(fx.notifications,['worker-a']);
 assert.equal(fx.calls.some(x=>/punch|scheduled_shift|payroll|gps|kilomet/.test(x.name)),false);
 await fx.win.happyDOM.close();
});
test('employee finishes first published mission, sees next; failures retain an idempotency key',async()=>{
 const fx=fixture();fx.list.push(
 {id:'first',version:2,worker_id:'worker-a',site_id:'site-a',mission_day:day,title:'Inspection',status:'published',sort_order:1,
  client_name:'Clinique Nadine',site_name:'Accueil',address_line:'123 rue des Érables',city:'Québec',country:'CA'},
 {id:'second',version:1,worker_id:'worker-a',site_id:'site-a',mission_day:day,title:'Nettoyage',status:'published',sort_order:2,
  client_name:'Clinique Nadine',site_name:'Bureau',address_line:'123 rue des Érables',city:'Québec',country:'CA'});
 await fx.sb.rpc('essential_missions_configuration',{p_company:'company',p_enabled:true});
 const c=createPersonalMissionController({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape:esc});
 await c.load('company','user','worker-a',day);
 assert.match(c.render(),/Prochaine mission · 1 de 2/);
 assert.match(c.render(),/Inspection/);
 fx.setFail(true);assert.equal(await c.finish('first'),false);
 assert.match(c.render(),/Fin non confirmée/);
 fx.setFail(false);assert.equal(await c.finish('first'),true);
 assert.match(c.render(),/Prochaine mission · 2 de 2/);
 assert.match(c.render(),/Nettoyage/);
 const completeCalls=fx.calls.filter(x=>x.name==='complete_essential_mission');
 assert.equal(completeCalls.length,2);assert.equal(completeCalls[0].args.p_request,completeCalls[1].args.p_request);
 assert.equal(await c.finish('second'),true);
 assert.match(c.render(),/Toutes les missions sont terminées/);
 assert.equal(fx.calls.some(x=>/punch|scheduled_shift|payroll|gps/.test(x.name)),false);
 await fx.win.happyDOM.close();
});
test('personal controller hides other employee and disabled missions without leaking addresses',async()=>{
 const fx=fixture();fx.list.push({id:'other',worker_id:'not-mine',status:'published',mission_day:day,version:1,
  client_name:'Autre client',title:'Privé',sort_order:1,site_name:'Privé',address_line:'Confidentiel'});
 await fx.sb.rpc('essential_missions_configuration',{p_company:'company',p_enabled:true});
 const c=createPersonalMissionController({sb:fx.sb,document:fx.win.document,redraw(){},notify(){},escape:esc});
 await c.load('company','user','worker-a',day);
 assert.equal(c.render(),'');
 await fx.sb.rpc('essential_missions_configuration',{p_company:'company',p_enabled:false});
 await c.load('company','user','worker-a',day);
 assert.equal(c.state.enabled,false);assert.equal(c.render(),'');
 await fx.win.happyDOM.close();
});
