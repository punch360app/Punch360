import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {missionChecklistItems,missionChecklistConfirmed} from '../web/live/mission-checklist.js';
import {missionDate,createMissionManager,createPersonalMissionController} from '../web/live/missions.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
const day=missionDate(),request='20d3ac44-10de-44d9-bc17-c835c44faee9';
test('checklist requires unique bounded labels and every item acknowledged',()=>{
 assert.deepEqual(missionChecklistItems(' Vérifier les accès\nNettoyer les surfaces\n'),['Vérifier les accès','Nettoyer les surfaces']);
 assert.throws(()=>missionChecklistItems(''),/1 à 8/);
 assert.throws(()=>missionChecklistItems('abc\nABC'),/unique/);
 assert.throws(()=>missionChecklistItems(Array(9).fill('Liste '+String(Math.random())).map((x,i)=>x+i).join('\n')),/1 à 8/);
 assert.equal(missionChecklistConfirmed(['A','B'],[0]),false);
 assert.equal(missionChecklistConfirmed(['A','B'],[0,1]),true);
});
function fixture(){
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=>request;
 const row={id:'mission-check',company_id:'company-A',worker_id:'worker-A',status:'in_progress',version:2,
  sort_order:1,mission_day:day,title:'Entretien du bâtiment',client_name:'Client A',site_name:'Lieu A',
  first_name:'Nadine',city:'Québec',address_line:'23 rue des Pins'};
 const calls=[],steps=['Vérifier les accès','Nettoyer les surfaces'];let required=false,failed=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true,comment_required:false,checklist_required:required,checklist_items:steps}};
  if(name==='set_essential_mission_checklist_policy'){if(args.p_company!=='company-A')return{error:{message:'Foreign company'}};required=args.p_required;steps.splice(0,steps.length,...args.p_items);return{data:{checklist_required:required,checklist_items:steps}};}
  if(name==='list_essential_client_sites')return{data:{items:[]}};
  if(name==='list_essential_missions')return{data:{enabled:true,comment_required:false,checklist_required:required,checklist_items:[...steps],
    items:[{...row,completion_checklist:args.p_include_drafts?row.completion_checklist||null:null}],truncated:false}};
  if(name==='complete_essential_mission'||name==='complete_essential_mission_v3'){
   if(failed)return {error:{message:'Réseau indisponible'}};
   if(args.p_company!=='company-A'||args.p_version!==row.version)return{error:{message:'Wrong company or version'}};
   if(required&&(name!=='complete_essential_mission_v3'||JSON.stringify(args.p_checklist)!==JSON.stringify(steps)))
    return{error:{message:'Toutes les étapes requises'}};
   row.status='completed';row.version++;row.completion_checklist=required?[...steps]:null;
   return {data:{status:'completed',version:row.version}};
  }
  throw Error('Unexpected RPC '+name);
 }};
 return{win,sb,row,steps,calls,setFailed:v=>{failed=v},getRequired:()=>required,setRequired:v=>{required=v}};
}
test('manager defines company checklist; employee must check all steps, retries safely, manager sees private proof',async()=>{
 const fx=fixture();
 const manager=createMissionManager({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await manager.load('company-A',[{id:'worker-A',name:'Nadine',status:'active'}]);
 fx.win.document.body.innerHTML=manager.render();
 fx.win.document.getElementById('mission-checklist-policy').value='Vérifier les accès\nNettoyer les surfaces';
 await manager.handle('checklist-enable',{dataset:{}});
 assert.equal(fx.getRequired(),true);
 assert.match(manager.render(),/Checklist de fin/);
 const employee=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await employee.load('company-A','user-A','worker-A',day);
 fx.win.document.body.innerHTML=employee.render();
 assert.match(employee.render(),/Checklist de fin obligatoire/);
 await assert.rejects(()=>employee.finish('mission-check'),/Cochez toutes les étapes/);
 assert.equal(fx.calls.filter(c=>c.name.startsWith('complete_essential_mission')).length,0);
 fx.win.document.getElementById('mission-proof-check-mission-check-0').checked=true;
 fx.win.document.getElementById('mission-proof-check-mission-check-1').checked=true;
 fx.setFailed(true);
 assert.equal(await employee.finish('mission-check'),false);
 assert.equal(fx.row.status,'in_progress');
 assert.match(employee.render(),/checked/);
 fx.setFailed(false);
 fx.win.document.body.innerHTML=employee.render();
 assert.equal(await employee.finish('mission-check'),true);
 const rpc=fx.calls.filter(c=>c.name==='complete_essential_mission_v3');
 assert.equal(rpc.length,2);assert.equal(rpc[0].args.p_request,rpc[1].args.p_request);
 assert.deepEqual(rpc[1].args.p_checklist,['Vérifier les accès','Nettoyer les surfaces']);
 assert.doesNotMatch(employee.render(),/Checklist privée confirmée/);
 await manager.load('company-A',[{id:'worker-A',name:'Nadine',status:'active'}]);
 assert.match(manager.render(),/Checklist privée confirmée/);
 assert.equal(fx.calls.some(c=>/punch|payroll|gps|scheduled_shift/.test(c.name)),false);
 await fx.win.happyDOM.close();
});
test('disabled checklist preserves legacy completion with no checklist RPC',async()=>{
 const fx=fixture();
 const employee=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape:esc,redraw(){},notify(){}});
 await employee.load('company-A','user-A','worker-A',day);
 assert.doesNotMatch(employee.render(),/Checklist de fin obligatoire/);
 assert.equal(await employee.finish('mission-check'),true);
 assert.equal(fx.calls.filter(c=>c.name==='complete_essential_mission_v3').length,0);
 assert.equal(fx.calls.filter(c=>c.name==='complete_essential_mission').length,1);
 await fx.win.happyDOM.close();
});
