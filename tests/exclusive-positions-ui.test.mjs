import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';

const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const site={id:'site',name:'Atelier',timezone:'America/Toronto',active:true};
const position={id:'p1',company_id:'tenant',title:'Caisse 1',location_id:'site',department_id:null,active:true,version:1};
const shift={id:'sh1',company_id:'tenant',worker_id:'w1',location_id:'site',department_id:null,starts_at:'2026-11-02T12:00:00Z',ends_at:'2026-11-02T20:00:00Z',timezone:'America/Toronto',version:3};
function setup(pro=true){
 const w=new Window(),calls=[];
 const sb={
 rpc:async(name,args)=>{calls.push({name,args});if(name==='essential_entitlements')return {data:{features:pro?['minimum_coverage','departments']:['departments']}};if(name==='essential_team_roster')return {data:[]};return {data:{shift_id:'sh1',version:4}};},
 from:()=>{const q={select:()=>q,eq:()=>q,gt:()=>q,lt:()=>q,order:()=>q,limit:()=>q,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;}
 };
 const ui=createPlanningController({sb,redraw(){},notify(){},escape:esc,document:w.document});
 Object.assign(ui.state,{company:'tenant',user:'user',own:'w1',role:'boss',entitlement:{features:pro?['minimum_coverage','departments']:['departments']},locations:[site],positions:[position],roster:[{id:'w1',name:'Alex'}],shifts:[shift],showForm:false});
 ui.state.form.posReason='Besoin opérationnel';
 return {w,ui,calls};
}
test('Pro managers see exclusive post controls on organization and shift calendar',async()=>{
 const {w,ui}=setup();
 w.document.body.innerHTML=ui.renderOrganization();
 assert.ok(w.document.querySelector('[data-action="ess:plan-pos-create"]'));
 assert.match(w.document.body.textContent,/Caisse 1/);
 w.document.body.innerHTML=ui.renderSchedule();
 assert.ok(w.document.querySelector('[data-action="ess:plan-pos-assign"]'));
 assert.ok(w.document.querySelector('#plan-posReason'));
 await w.happyDOM.close();
});
test('assigning exclusive position transmits current shift version and reason',async()=>{
 const {w,ui,calls}=setup();
 w.document.body.innerHTML=ui.renderSchedule();
 w.document.getElementById('plan-pos-sh1').value='p1';
 w.document.getElementById('plan-posReason').value='Besoin opérationnel';
 await ui.handle({dataset:{action:'ess:plan-pos-assign',id:'sh1'}});
 const found=calls.find(c=>c.name==='assign_essential_position');
 assert.deepEqual(found.args,{p_company:'tenant',p_shift:'sh1',p_position:'p1',p_expected_version:3,p_reason:'Besoin opérationnel'});
 await w.happyDOM.close();
});
test('Plus never shows exclusive post controls',async()=>{
 const {w,ui}=setup(false);
 w.document.body.innerHTML=ui.renderOrganization();
 assert.equal(w.document.querySelector('[data-action="ess:plan-pos-create"]'),null);
 w.document.body.innerHTML=ui.renderSchedule();
 assert.equal(w.document.querySelector('[data-action="ess:plan-pos-assign"]'),null);
 await w.happyDOM.close();
});
