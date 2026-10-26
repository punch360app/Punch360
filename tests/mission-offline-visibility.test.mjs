import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionWarningEligible} from '../web/live/missions.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
test('known active missions show an explicit offline state, never a phantom completion',async()=>{
 const win=new Window();
 let fail=false,enabled=true;
 const calls=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(fail)return{error:{message:'Connexion indisponible'}};
  return{data:{enabled,items:[{id:'m1',status:'published',sort_order:1,title:'Nettoyer',client_name:'Client',site_name:'Lieu',
    address_line:'123 rue des Érables',city:'Québec',country:'CA',version:1}],truncated:false}};
 }};
 const ctrl=createPersonalMissionController({sb,document:win.document,escape,redraw(){},notify(){}});
 await ctrl.load('company-A','user-A','worker-A');
 assert.match(ctrl.render(),/Prochaine mission/);
 fail=true;
 await ctrl.load('company-A','user-A','worker-A');
 const state=ctrl.render();
 assert.match(state,/Missions momentanément indisponibles/);
 assert.match(state,/Aucune fin de mission n’a été enregistrée/);
 assert.doesNotMatch(state,/Nettoyer|Terminer<\/button>/);
 assert.equal(calls.some(x=>x.name==='complete_essential_mission'),false);
 assert.equal(ctrl.state.items.length,0);
 // Workspace switch must not reveal previous company's warning or missions.
 await ctrl.load('company-B','user-A','worker-B');
 assert.equal(ctrl.render(),'');
 fail=false;enabled=false;await ctrl.load('company-B','user-A','worker-B');
 assert.equal(ctrl.render(),'');
 ctrl.reset();assert.equal(ctrl.render(),'');
 await win.happyDOM.close();
});
test('warning appears only after this exact worker/company already saw missions enabled',()=>{
 assert.equal(missionWarningEligible(true,true),true);
 assert.equal(missionWarningEligible(true,false),false);
 assert.equal(missionWarningEligible(false,true),false);
 assert.equal(missionWarningEligible(false,false),false);
});
