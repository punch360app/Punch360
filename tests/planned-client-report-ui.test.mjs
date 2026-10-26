import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=new Date().toISOString().slice(0,10),tomorrow=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
const shift={id:'q1',company_id:'company-a',worker_id:'worker-a',client_site_id:'site-a',starts_at:today+'T08:00:00Z',
 ends_at:today+'T12:00:00Z',timezone:'America/Toronto',version:1,department_id:null};
const location={shift_id:'q1',worker_id:'worker-a',client_site_id:'site-a',
 site_name:'Chez Nadine',client_name:'Bureaux Nadine',address_line:'123 rue des Érables',city:'Saint-Augustin-de-Desmaures'};
function fixture(){
 const window=new Window();window.confirm=()=>true;
 const calls=[],notices=[];
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_entitlements')return {data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return {data:[{id:'worker-a',name:'Nadine',status:'active'}]};
  if(name==='list_essential_assigned_client_sites')return {data:{items:[location],has_more:false}};
  if(name==='list_essential_clients'||name==='list_essential_client_sites')return {data:{items:[],has_more:false}};
  return {data:[]};
 },from(table){
  const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
   then(resolve){return Promise.resolve({data:table==='scheduled_shifts'?[shift]:[],error:null}).then(resolve);}};return q;
 }};
 const ui=createPlanningController({sb:db,escape:e,document:window.document,redraw(){},notify(message){notices.push(message)}});
 return {ui,window,calls,notices};
}
test('manager can calculate client planned hours from authorized existing shift and destination',async()=>{
 const {ui,window,calls}=fixture();
 Object.assign(ui.state.form,{calendarFrom:today,calendarTo:tomorrow,reportFrom:today,reportTo:tomorrow});
 await ui.load({company_id:'company-a',role:'boss'},'boss',null,[]);
 ui.state.tab='report';
 window.document.body.innerHTML=ui.renderSchedule();
 assert.match(window.document.body.textContent,/Heures planifiées par client et adresse/);
 await ui.handle({dataset:{action:'ess:plan-client-planned-report'}});
 assert.equal(ui.state.clientPlannedReport?.totalHours,4);
 assert.equal(ui.state.clientPlannedReport?.actualHours,null);
 window.document.body.innerHTML=ui.renderSchedule();
 assert.match(window.document.body.textContent,/Bureaux Nadine/);
 assert.match(window.document.body.textContent,/4\.00 h/);
 assert.match(window.document.body.textContent,/Heures réellement travaillées par client : non attribuées/);
 assert.equal(calls.filter(x=>x.name==='save_essential_shift'||x.name==='punch_transfer').length,0);
 await window.happyDOM.close();
});
test('manager report refuses incomplete period and employee cannot read or calculate company-wide client report',async()=>{
 const {ui,window}=fixture();
 Object.assign(ui.state.form,{calendarFrom:today,calendarTo:tomorrow,reportFrom:today,reportTo:new Date(Date.parse(today+'T00:00:00Z')+3*86400000).toISOString().slice(0,10)});
 await ui.load({company_id:'company-a',role:'boss'},'boss',null,[]);
 ui.state.tab='report';window.document.body.innerHTML=ui.renderSchedule();
 await ui.handle({dataset:{action:'ess:plan-client-planned-report'}});
 assert.equal(ui.state.clientPlannedReport,null);
 assert.match(ui.state.error,/postérieure/);
 await ui.load({company_id:'company-a',role:'employee'},'employee','worker-a',[]);
 ui.state.tab='report';window.document.body.innerHTML=ui.renderSchedule();
 assert.doesNotMatch(window.document.body.textContent,/Heures planifiées par client et adresse/);
 await ui.handle({dataset:{action:'ess:plan-client-planned-report'}});
 assert.equal(ui.state.clientPlannedReport,null);
 await window.happyDOM.close();
});
