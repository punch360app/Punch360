import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {canSendVisitAlert,prepareVisitAlert,visitAlertLabel} from '../web/live/visit-alerts.js';
import {createPlanningController} from '../web/live/planning.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const request='11111111-2222-4333-8444-555555555555';
const near=Date.now()+3*3600000;
const shift={id:'shift-a',company_id:'tenant',worker_id:'worker-a',location_id:'branch',department_id:null,
 starts_at:new Date(near).toISOString(),ends_at:new Date(near+4*3600000).toISOString(),
 version:1,timezone:'America/Toronto',note:'Quart client',cancelled_at:null};
test('voluntary alert is restricted to assigned shift near its date; cannot create GPS, ETA or silent delay',()=>{
 assert.equal(canSendVisitAlert(shift,'worker-a'),true);
 assert.equal(canSendVisitAlert(shift,'worker-b'),false);
 assert.equal(canSendVisitAlert({...shift,cancelled_at:new Date().toISOString()},'worker-a'),false);
 assert.equal(canSendVisitAlert({...shift,starts_at:new Date(Date.now()+10*86400000).toISOString(),
  ends_at:new Date(Date.now()+10*86400000+3600000).toISOString()},'worker-a'),false);
 assert.deepEqual(prepareVisitAlert(shift,'worker-a','possible_delay','  Je serai peut-être en retard ',request),
  {p_shift:'shift-a',p_kind:'possible_delay',p_note:'Je serai peut-être en retard',p_request:request});
 assert.throws(()=>prepareVisitAlert(shift,'worker-a','access_issue','X'.repeat(501),request),/500/);
 assert.throws(()=>prepareVisitAlert(shift,'worker-a','invalid','',request),/type/);
 assert.equal(visitAlertLabel({kind:'access_issue',status:'acknowledged'}),'Problème d’accès · Pris en charge');
});
function fixture(){
 const w=new Window();w.confirm=()=>true;
 const calls=[],alerts=[],notices=[];
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_entitlements')return{data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return{data:[{id:'worker-a',name:'Nadine',status:'active'}]};
  if(name==='list_essential_visit_alerts')return{data:{items:alerts.map(x=>({...x})),limited:false}};
  if(name==='submit_essential_visit_alert'){
   const id='alert-123',entry={id,shift_id:args.p_shift,kind:args.p_kind,
    note:args.p_note,status:'reported',employee_name:'Nadine',created_at:new Date().toISOString()};
   alerts.push(entry);return{data:{id,status:'reported',delivered:1,replayed:false,kind:args.p_kind}};
  }
  if(name==='acknowledge_essential_visit_alert'){const item=alerts.find(x=>x.id===args.p_alert);item.status='acknowledged';return{data:{id:item.id,status:item.status}};}
  if(name==='list_essential_clients'||name==='list_essential_client_sites')return{data:{items:[],has_more:false}};
  return{data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
  then(resolve){const data=table==='scheduled_shifts'?[shift]:table==='essential_locations'?[{id:'branch',name:'Atelier',active:true,timezone:'America/Toronto'}]:[];
   return Promise.resolve({data,error:null}).then(resolve)}
 };return q;}};
 const ui=createPlanningController({sb,document:w.document,escape:esc,redraw(){},notify(message){notices.push(message)}});
 return {w,ui,calls,alerts,notices};
}
test('employee opens own visit warning and manager sees private note then acknowledges',async()=>{
 const {w,ui,calls,alerts}=fixture();
 await ui.load({company_id:'tenant',role:'employee'},'employee-a','worker-a',[]);
 ui.state.tab='calendar';
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Prévenir d’un retard/);
 assert.doesNotMatch(w.document.body.textContent,/Confirmer l’avis interne/);
 await ui.handle({dataset:{action:'ess:plan-visit-open',id:'shift-a'}});
 assert.equal(ui.state.visitAlertShift,'shift-a');
 assert.ok(ui.state.visitRequest);
 w.document.body.innerHTML=ui.renderSchedule();
 w.document.getElementById('plan-visitKind').value='access_issue';
 w.document.getElementById('plan-visitNote').value='La porte est fermée, merci de rappeler';
 await ui.handle({dataset:{action:'ess:plan-visit-send',id:'shift-a'}});
 assert.equal(ui.state.visitAlertShift,null);
 assert.equal(alerts.length,1);
 assert.equal(calls.filter(x=>x.name==='submit_essential_visit_alert').length,1);
 assert.equal(alerts[0].note,'La porte est fermée, merci de rappeler');
 assert.match(ui.renderSchedule(),/Problème d’accès · Transmis au responsable/);
 await ui.load({company_id:'tenant',role:'boss'},'boss',null,[]);
 ui.state.tab='calendar';
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/La porte est fermée, merci de rappeler/);
 await ui.handle({dataset:{action:'ess:plan-visit-ack',id:'alert-123'}});
 assert.equal(alerts[0].status,'acknowledged');
 assert.match(ui.renderSchedule(),/Pris en charge/);
 assert.equal(calls.some(x=>/punch|geofence|gps|save_essential_shift|payment/.test(x.name)),false);
 await w.happyDOM.close();
});
test('coworker cannot report someone else shift, manager cannot submit as coworker',async()=>{
 const {w,ui,calls}=fixture();
 await ui.load({company_id:'tenant',role:'employee'},'other','worker-b',[]);
 ui.state.tab='calendar';
 assert.doesNotMatch(ui.renderSchedule(),/Prévenir d’un retard \/ problème d’accès/);
 await ui.handle({dataset:{action:'ess:plan-visit-open',id:'shift-a'}});
 assert.match(ui.state.error,/Seul le salarié affecté/);
 assert.equal(calls.filter(x=>x.name==='submit_essential_visit_alert').length,0);
 await w.happyDOM.close();
});
