import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionDate} from '../web/live/missions.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
function setup() {
 const win=new Window();win.confirm=()=>true;
 let online=true,auth='user-A',required=false;
 Object.defineProperty(win.navigator,'onLine',{configurable:true,get:()=>online});
 const calls=[],notices=[],day=missionDate();
 const row={id:'mission-A',worker_id:'worker-A',mission_day:day,title:'Installation',
  client_name:'Client fictif',site_name:'Lieu fictif',status:'published',
  sort_order:1,version:1,address_line:'123 rue de test',city:'Québec'};
 const sb={auth:{async getUser(){return{data:{user:{id:auth}},error:null}}},async rpc(name,args){
  calls.push({name,args});
  if(name==='list_essential_missions')return{data:{
   enabled:true,comment_required:required,checklist_required:false,photo_required:false,
   photo_optional:false,items:args.p_company==='company-A'?[{...row}]:[],
   truncated:false
  }};
  if(name==='complete_essential_mission'){
   if(args.p_company!=='company-A'||row.version!==args.p_version)
    return{error:{message:'Accès ou version modifiée'}};
   row.status='completed';row.version++;
   return {data:{id:row.id,version:row.version,status:'completed'}};
  }
  throw Error('Unexpected call '+name);
 }};
 const controller=createPersonalMissionController({sb,document:win.document,escape,
  redraw(){},notify:x=>notices.push(x)});
 return {win,controller,calls,notices,row,day,
  offline:()=>{online=false},online:()=>{online=true},
  changeUser:x=>{auth=x},requireProof:()=>{required=true}};
}
test('real Web card stages offline completion, shows pending, then server confirms exactly once',async()=>{
 const fx=setup();const {controller,calls,win}=fx;
 await controller.load('company-A','user-A','worker-A');
 assert.match(controller.render(),/Prochaine mission/);
 fx.offline();
 assert.equal(await controller.finish('mission-A'),true);
 assert.equal(calls.filter(x=>x.name==='complete_essential_mission').length,0);
 assert.match(controller.render(),/en attente/i);
 assert.doesNotMatch(controller.render(),/Toutes les missions sont terminées/);
 const keys=Object.keys(win.sessionStorage);
 assert.ok(keys.some(x=>x.includes('mission-A')));
 assert.equal(JSON.stringify(win.sessionStorage).includes('Installation'),false);
 fx.online();
 assert.equal(await controller.syncQueued(),true);
 assert.equal(calls.filter(x=>x.name==='complete_essential_mission').length,1);
 assert.match(controller.render(),/Toutes les missions sont terminées/);
 assert.equal(controller.state.queued.length,0);
 await win.happyDOM.close();
});
test('switching company cannot replay a pending mission from previous company',async()=>{
 const fx=setup();const {controller,calls,win}=fx;
 await controller.load('company-A','user-A','worker-A');fx.offline();
 assert.equal(await controller.finish('mission-A'),true);
 await controller.load('company-B','user-A','worker-B');
 fx.online();
 await controller.load('company-B','user-A','worker-B');
 assert.equal(controller.state.queued.length,0);
 assert.equal(calls.filter(x=>x.name==='complete_essential_mission').length,0);
 await win.happyDOM.close();
});
test('changed proof policy or Auth identity blocks replay but retains request',async()=>{
 const fx=setup();const {controller,calls,win}=fx;
 await controller.load('company-A','user-A','worker-A');fx.offline();
 assert.equal(await controller.finish('mission-A'),true);
 fx.online();fx.requireProof();
 assert.equal(await controller.syncQueued(),true);
 assert.equal(calls.filter(x=>x.name==='complete_essential_mission').length,0);
 assert.equal(controller.state.queued.length,1);
 fx.changeUser('other-user');
 assert.equal(await controller.syncQueued(),false);
 assert.equal(controller.state.queued.length,1);
 await win.happyDOM.close();
});

test('after reload without network, pending opaque count remains visible without stale client data',async()=>{
 const fx=setup();const {controller,win}=fx;
 await controller.load('company-A','user-A','worker-A');fx.offline();
 assert.equal(await controller.finish('mission-A'),true);
 const second=createPersonalMissionController({sb:{...fx.controller.state.sb,rpc:async()=>({error:{message:'offline'}})},
  document:win.document,escape,redraw(){},notify(){}});
 await second.load('company-A','user-A','worker-A');
 assert.equal(second.state.items.length,0);
 assert.equal(second.state.queued.length,1);
 assert.match(second.render(),/toujours en attente/);
 assert.doesNotMatch(second.render(),/Installation|Client fictif|123 rue de test/);
 await win.happyDOM.close();
});
