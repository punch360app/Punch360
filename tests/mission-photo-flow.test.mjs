import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp','<':'&lt','>':'&gt','"':'&quot',"'":'&#39'}[z]));
const day=missionDate(),photo='d5d68cc1-f010-44bd-9580-f36caccf5400';
test('manager enables private photo, employee completes with upload and V4, proof never leaks into employee view',async()=>{
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=> '0bfabc18-bd6d-4491-9708-0160278031f3';
 const row={id:'mission-A',company_id:'company-A',worker_id:'worker-A',status:'published',version:1,
  sort_order:1,mission_day:day,title:'Nettoyage étage',client_name:'Client A',site_name:'Bâtiment A',
  first_name:'Nadine',city:'Québec',address_line:'23 rue des Pins'};
 let mode='none';const calls=[],uploads=[],requests=[];
 const sb={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='essential_missions_configuration')return{data:{enabled:true,comment_required:false,checklist_required:false,photo_required:mode==='required',photo_optional:mode==='optional',checklist_items:[]}};
   if(name==='set_essential_mission_photo_mode'){assert.equal(args.p_company,'company-A');mode=args.p_mode;return{data:{photo_required:mode==='required',photo_optional:mode==='optional'}};}
   if(name==='list_essential_client_sites')return{data:{items:[]}};
   if(name==='list_essential_missions')return{data:{enabled:true,comment_required:false,checklist_required:false,photo_required:mode==='required',photo_optional:mode==='optional',checklist_items:[],
    items:[{...row,completion_photo_id:args.p_include_drafts?row.completion_photo_id||null:null}],truncated:false}};
   if(name==='complete_essential_mission_v4'){
    requests.push(args);assert.equal(args.p_company,'company-A');
    assert.equal(args.p_photo,photo);assert.equal(args.p_comment,null);assert.equal(args.p_checklist,null);
    assert.equal(args.p_version,1);row.status='completed';row.version++;row.completion_photo_id=photo;
    return{data:{status:'completed',version:2,photo_saved:true}};
   }
   throw Error('Unexpected RPC '+name);
  },
  functions:{invoke:async(name,{body})=>{
   assert.equal(name,'mission-photo');uploads.push(body);
   if(body?.action==='view')return {data:{url:'https://mlabstdxxwjdpfaxiwmg.supabase.co/storage/v1/object/sign/mission-photo-evidence/foo'}};
   assert.equal(body.get('company'),'company-A');
   assert.equal(body.get('mission'),'mission-A');
   assert.equal(body.get('version'),'1');
   assert.ok(body.get('file'));
   return{data:{photo_id:photo}};
  }}
 };
 const manager=createMissionManager({sb,document:win.document,escape,redraw(){},notify(){}});
 await manager.load('company-A',[{id:'worker-A',status:'active',name:'Nadine'}]);
 assert.match(manager.render(),/Exiger une photo/);
 await manager.handle('photo-mode-required',{dataset:{}});
 assert.equal(mode,'required');assert.match(manager.render(),/Photo privée de fin/);
 const employee=createPersonalMissionController({sb,document:win.document,escape,redraw(){},notify(){}});
 await employee.load('company-A','user-A','worker-A',day);
 win.document.body.innerHTML=employee.render();
 assert.match(employee.render(),/Photo privée obligatoire/);
 await assert.rejects(employee.finish('mission-A'),/Choisissez une photo/);
 assert.equal(requests.length,0);
 const node=win.document.getElementById('mission-photo-file-mission-A');
 const file=new win.File([new Uint8Array(32)],'preuve.png',{type:'image/png'});
 Object.defineProperty(node,'files',{configurable:true,value:[file]});
 assert.equal(await employee.finish('mission-A'),true);
 assert.equal(requests.length,1);assert.equal(uploads.length,1);
 assert.doesNotMatch(employee.render(),/Voir la photo privée/);
 await manager.load('company-A',[{id:'worker-A',status:'active',name:'Nadine'}]);
 assert.match(manager.render(),/Voir la photo privée/);
 assert.equal(calls.some(x=>/payroll|punch|scheduled_shift|gps/i.test(x.name)),false);
 await win.happyDOM.close();
});
test('old completion API remains unchanged when photo policy is off',async()=>{
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=> '6f1e4a9b-156e-4674-a5ca-3b3d06f57bc8';
 let completed=false;
 const sb={rpc:async(name,args)=>{
  if(name==='list_essential_missions')return{data:{enabled:true,photo_required:false,checklist_required:false,comment_required:false,truncated:false,items:completed?[]:
   [{id:'mission-B',worker_id:'worker-B',status:'published',version:1,sort_order:1,title:'Mission sans photo',mission_day:day,site_name:'Lieu',client_name:'Client'}]}};
  if(name==='complete_essential_mission'){completed=true;return{data:{status:'completed'}};}
  throw Error('Unexpected '+name);
 }};
 const e=createPersonalMissionController({sb,document:win.document,escape,redraw(){},notify(){}});
 await e.load('company-B','user-B','worker-B',day);
 assert.doesNotMatch(e.render(),/Photo privée obligatoire/);
 assert.equal(await e.finish('mission-B'),true);
 assert.equal(completed,true);
 await win.happyDOM.close();
});
