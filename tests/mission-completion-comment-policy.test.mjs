import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createMissionManager,createPersonalMissionController,missionDate} from '../web/live/missions.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
const day=missionDate(),request='20d3ac44-10de-44d9-bc17-c835c44faee9';
function fixture(){
 const win=new Window();win.confirm=()=>true;win.crypto.randomUUID=()=>request;
 const calls=[],row={id:'mission-proof',company_id:'company-A',worker_id:'worker-A',site_id:'site-A',
  mission_day:day,version:2,status:'in_progress',sort_order:1,title:'Inspection du local',
  client_name:'Client privé',site_name:'Lieu A',address_line:'32 rue des Pins',city:'Québec',first_name:'Nadine'};
 let required=false,fail=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true,comment_required:required}};
  if(name==='set_essential_mission_proof_policy'){if(args.p_company!=='company-A')return {error:{message:'Compagnie étrangère'}};required=args.p_comment_required;return{data:{comment_required:required}};}
  if(name==='list_essential_client_sites')return {data:{items:[{id:'site-A',name:'Lieu A',active:true}]}};
  if(name==='list_essential_missions')return {data:{enabled:true,comment_required:required,items:
   row.status==='completed'&&row.mission_day!==args.p_day?[]:
   [{...row,completion_comment:args.p_include_drafts?row.completion_comment||null:null}],truncated:false}};
  if(name==='complete_essential_mission'||name==='complete_essential_mission_v2'){
   if(fail)return{error:{message:'Déconnexion'}};
   if(args.p_company!=='company-A'||args.p_id!==row.id||args.p_version!==row.version)return{error:{message:'Mission modifiée'}};
   if(required&&(name!=='complete_essential_mission_v2'||String(args.p_comment||'').trim().length<5))
    return{error:{message:'Commentaire de fin requis'}};
   row.status='completed';row.version++;row.completion_comment=required?args.p_comment:null;
   return{data:{id:row.id,status:'completed',version:row.version}};
  }
  throw Error('Unexpected RPC '+name);
 }};
 return {win,sb,calls,row,getRequired:()=>required,setRequired:v=>{required=v},setFail:v=>{fail=v}};
}
test('manager sets company-level proof policy and can read completed comment; HTML is escaped',async()=>{
 const fx=fixture();fx.row.status='completed';fx.row.completion_comment='<script>secret</script>';
 const manager=createMissionManager({sb:fx.sb,document:fx.win.document,escape,redraw(){},notify(){}});
 await manager.load('company-A',[{id:'worker-A',name:'Nadine',status:'active'}]);
 assert.match(manager.render(),/aucune preuve exigée/);
 assert.match(manager.render(),/Preuve privée de fin/);
 assert.doesNotMatch(manager.render(),/<script>secret<\/script>/);
 await manager.handle('proof-policy',{dataset:{}});
 assert.equal(fx.getRequired(),true);
 assert.match(manager.render(),/commentaire obligatoire/);
 const actions=fx.calls.filter(c=>c.name==='set_essential_mission_proof_policy');
 assert.deepEqual(actions[0].args,{p_company:'company-A',p_comment_required:true});
 await manager.handle('proof-policy',{dataset:{}});
 assert.equal(fx.getRequired(),false);
 await fx.win.happyDOM.close();
});
test('worker must supply private comment, failed network preserves entry and request ID',async()=>{
 const fx=fixture();fx.setRequired(true);
 const ctrl=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape,redraw(){},notify(){}});
 await ctrl.load('company-A','user-A','worker-A',day);
 assert.match(ctrl.render(),/Commentaire de fin obligatoire/);
 fx.win.document.body.innerHTML=ctrl.render();
 await assert.rejects(()=>ctrl.finish('mission-proof'),/Commentaire de fin requis/);
 assert.equal(fx.calls.filter(c=>c.name.startsWith('complete_essential_mission')).length,0);
 fx.win.document.getElementById('mission-completion-comment-mission-proof').value='Réparation effectuée et porte refermée';
 fx.setFail(true);
 assert.equal(await ctrl.finish('mission-proof'),false);
 assert.equal(fx.row.status,'in_progress');
 assert.match(ctrl.render(),/Réparation effectuée/);
 fx.setFail(false);
 assert.equal(await ctrl.finish('mission-proof'),true);
 assert.equal(fx.row.status,'completed');
 assert.equal(fx.row.completion_comment,'Réparation effectuée et porte refermée');
 const attempts=fx.calls.filter(c=>c.name==='complete_essential_mission_v2');
 assert.equal(attempts.length,2);assert.equal(attempts[0].args.p_request,attempts[1].args.p_request);
 assert.equal(fx.calls.some(c=>/punch|shifts|payroll|gps|invoice/.test(c.name)),false);
 await fx.win.happyDOM.close();
});
test('policy NONE preserves legacy completion and worker never receives manager-only proof',async()=>{
 const fx=fixture();fx.row.completion_comment='Ancienne preuve cachée';
 const ctrl=createPersonalMissionController({sb:fx.sb,document:fx.win.document,escape,redraw(){},notify(){}});
 await ctrl.load('company-A','user-A','worker-A',day);
 assert.doesNotMatch(ctrl.render(),/Ancienne preuve cachée|Commentaire de fin obligatoire/);
 assert.equal(await ctrl.finish('mission-proof'),true);
 assert.equal(fx.calls.filter(c=>c.name==='complete_essential_mission').length,1);
 assert.equal(fx.calls.filter(c=>c.name==='complete_essential_mission_v2').length,0);
 await ctrl.load('company-B','user-B','worker-B',day);
 assert.equal(ctrl.state.commentRequired,false);
 assert.equal(ctrl.state.completionDraft,null);
 await fx.win.happyDOM.close();
});
