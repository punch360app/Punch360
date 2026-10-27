import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionDate} from '../web/live/missions.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
const day=missionDate();
const mission={id:'mission-a',worker_id:'worker-a',mission_day:day,status:'published',version:2,sort_order:1,
 title:'Mission assignée',client_name:'Client A',site_name:'Site A',address_line:'100 rue A',city:'Québec'};
function fixture(){
 const win=new Window();win.confirm=()=>true;
 let fail=false,hold=null;const calls=[];
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='list_essential_missions'){
   return {data:{enabled:true,truncated:false,items:args.p_company==='company-a'?[mission]:[]}};
  }
  if(name==='get_essential_published_mission_details'){
   if(hold)return hold;
   if(fail)return {error:{message:'Accès refusé ou réseau indisponible'}};
   return {data:{id:args.p_id,version:args.p_version,
    title:'Mission assignée',instructions:'Accès par porte avant <script>alert(1)</script> & ne pas partager'}};
  }
  throw Error('Unexpected RPC '+name);
 }};
 const ctrl=createPersonalMissionController({sb,document:win.document,escape,redraw(){},notify(){}});
 return {ctrl,win,calls,setFail:x=>fail=x,setHold:x=>hold=x};
}
test('employee explicitly opens assigned mission instructions and Web escapes private content',async()=>{
 const fx=fixture();await fx.ctrl.load('company-a','user-a','worker-a');
 assert.match(fx.ctrl.render(),/Détails de la mission/);
 assert.doesNotMatch(fx.ctrl.render(),/Accès par porte/);
 assert.equal(await fx.ctrl.handleDetails('open','mission-a'),true);
 const html=fx.ctrl.render();
 assert.match(html,/Instructions de cette mission/);
 assert.match(html,/Accès par porte avant/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/CODE-ACCES-SITE/);
 const detailCalls=fx.calls.filter(x=>x.name==='get_essential_published_mission_details');
 assert.deepEqual(detailCalls.map(x=>x.args),[{p_company:'company-a',p_id:'mission-a',p_version:2}]);
 assert.equal(fx.calls.filter(x=>/punch|shift|gps|payroll/.test(x.name)).length,0);
 assert.equal(await fx.ctrl.handleDetails('close','mission-a'),true);
 assert.doesNotMatch(fx.ctrl.render(),/Accès par porte avant/);
 await fx.win.happyDOM.close();
});
test('server denies private details without exposing instruction text, and no wrong mission may be requested',async()=>{
 const fx=fixture();await fx.ctrl.load('company-a','user-a','worker-a');
 fx.setFail(true);assert.equal(await fx.ctrl.handleDetails('open','mission-a'),false);
 assert.match(fx.ctrl.render(),/Accès refusé ou réseau indisponible/);
 assert.doesNotMatch(fx.ctrl.render(),/Accès par porte/);
 await assert.rejects(fx.ctrl.handleDetails('open','coworker-mission'),/Mission publiée absente/);
 assert.equal(fx.calls.filter(x=>x.name==='get_essential_published_mission_details').length,1);
 await fx.win.happyDOM.close();
});
test('late details response is discarded after company or worker changes',async()=>{
 const fx=fixture();await fx.ctrl.load('company-a','user-a','worker-a');
 let release;const pending=new Promise(resolve=>{release=resolve});fx.setHold(pending);
 const loading=fx.ctrl.handleDetails('open','mission-a');
 await fx.ctrl.load('company-b','user-b','worker-b');
 release({data:{id:'mission-a',version:2,instructions:'CONFIDENTIEL-ANCIEN-COMPTE'}});
 await loading;
 assert.equal(fx.ctrl.state.details,null);
 assert.equal(fx.ctrl.state.company,'company-b');
 assert.doesNotMatch(fx.ctrl.render(),/CONFIDENTIEL|Mission assignée/);
 await fx.win.happyDOM.close();
});
test('published-to-completed or changed-version mission does not keep previously revealed instructions',async()=>{
 const fx=fixture();await fx.ctrl.load('company-a','user-a','worker-a');
 await fx.ctrl.handleDetails('open','mission-a');assert.match(fx.ctrl.render(),/Accès par porte/);
 fx.ctrl.state.items[0].status='completed';
 await fx.ctrl.load('company-a','user-a','worker-a');
 assert.equal(fx.ctrl.state.details,null);
 assert.doesNotMatch(fx.ctrl.render(),/Accès par porte/);
 await fx.win.happyDOM.close();
});
