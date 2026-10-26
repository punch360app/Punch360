import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {preferencePayload,contractPayload,parseHour,periodLabel} from '../web/live/schedule-preferences.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const location={id:'site',name:'Atelier',active:true,timezone:'America/Toronto'};
const employee={worker_id:'worker',employee_number:'23',first_name:'Alex',last_name:'Test',version:2,
 desired_weekly_hours:35,preferred_periods:['day'],weekend_preference:'flexible',overtime_volunteer:false,
 last_minute_volunteer:false,desired_extra_weekly_hours:null,seniority_from:'2022-02-02',
 contracted_min_weekly_hours:25,contracted_max_weekly_hours:40,certifications:[{title:'SIMDUT',expires_on:null}]};
const noPhone={...employee,worker_id:'no-phone',employee_number:'24',first_name:'Sans',last_name:'Cellulaire',version:1};
const ent={title:'Essentiel Plus',features:['availability','advanced_schedules']};
function setup(role='employee'){
 const w=new Window();w.confirm=()=>true;const calls=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(name==='essential_entitlements')return {data:ent};
  if(name==='essential_team_roster')return {data:[]};
  if(name==='list_essential_worker_schedule_preferences')return {data:[employee,noPhone]};
  if(name==='list_essential_weekly_availability'||name==='list_essential_shift_absences')return {data:[]};
  if(name==='essential_availability_shift_preview')return {data:{shifts:[]}};
  if(name==='personal_calendar_feed_status')return {data:{active:false}};
  if(name==='save_essential_worker_schedule_preferences')return {data:{worker_id:args.p_worker,version:3}};
  if(name==='set_essential_worker_schedule_constraints')return {data:{worker_id:args.p_worker,version:3}};
  return {data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:table==='essential_locations'?[location]:[],error:null}).then(resolve)}};return q;}};
 const ui=createPlanningController({sb,redraw(){},notify(){},escape,document:w.document});
 Object.assign(ui.state,{company:'tenant',role,user:role==='boss'?'boss-id':'employee-id',own:role==='boss'?null:'worker',
 entitlement:ent,workers:[{id:'worker',status:'active',first_name:'Alex',last_name:'Test'},{id:'no-phone',status:'active',first_name:'Sans',last_name:'Cellulaire'}],
 workerPrefs:[employee,noPhone],prefsUnavailable:false,weeklyRules:[],weeklyPreview:[],weeklyUnavailable:false,tab:'availability',
 locations:[location],scopes:[],roster:[],availability:[],shifts:[]});
 Object.assign(ui.state,{prefLoadedWorker:role==='boss'?null:'worker',prefLoadedVersion:2});
 Object.assign(ui.state.form,{prefWorker:role==='boss'?'no-phone':'worker',prefVersion:2,
 prefDesired:'35',prefPeriods:'day',prefWeekend:'flexible',prefVolunteer:'false',prefLastMinute:'false',prefExtra:'',
 contractSeniority:'2022-02-02',contractMin:'25',contractMax:'40',calendarFrom:'2026-11-01',calendarTo:'2026-12-01'});
 return {ui,w,calls};
}
test('employee preference data validates ranges and never turns volunteers into earned overtime',()=>{
 assert.equal(parseHour('35,5',80,'Heures'),35.5);
 assert.throws(()=>parseHour('120',80,'Heures'),/0 et 80/);
 assert.equal(periodLabel(['day','night']),'jour, nuit');
 const form={prefDesired:'37',prefPeriods:'day,evening',prefWeekend:'avoid',prefVolunteer:'true',prefLastMinute:'true',prefExtra:'4'};
 const args=preferencePayload(form,'worker','some-request',2);
 assert.deepEqual(args.p_periods,['day','evening']);assert.equal(args.p_extra,4);assert.equal(args.p_volunteer,true);
 const off=preferencePayload({...form,prefVolunteer:'false'},'worker','some-request',2);
 assert.equal(off.p_extra,null);assert.equal(off.p_last_minute,false);
 assert.throws(()=>preferencePayload({...form,prefPeriods:'day,day'},'worker','r',0),/invalides/);
 assert.throws(()=>contractPayload({contractMin:'45',contractMax:'35',contractSeniority:''},'worker',1),/dépasse/);
});
test('employee can save own desired hours with server version and keeps HR constraints untouched',async()=>{
 const {ui,w,calls}=setup('employee');
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Mes préférences de travail/);
 assert.match(w.document.body.textContent,/SIMDUT/);
 assert.equal(w.document.querySelector('[data-action="ess:plan-contract-save"]'),null);
 await ui.handle({dataset:{action:'ess:plan-pref-save'}});
 const save=calls.find(x=>x.name==='save_essential_worker_schedule_preferences');
 assert.equal(save.args.p_company,'tenant');
 assert.equal(save.args.p_worker,'worker');
 assert.equal(save.args.p_desired,35);
 assert.equal(save.args.p_version,2);
 assert.equal(calls.some(x=>x.name==='set_essential_worker_schedule_constraints'||x.name==='save_essential_shift'),false);
 await w.happyDOM.close();
});
test('boss loads accountless employee and uses separate audited contract save RPC',async()=>{
 const {ui,w,calls}=setup('boss');
 w.document.body.innerHTML=ui.renderSchedule();
 w.document.getElementById('plan-prefWorker').value='no-phone';
 await ui.handle({dataset:{action:'ess:plan-pref-load'}});
 assert.equal(ui.state.prefLoadedWorker,'no-phone');
 assert.equal(ui.state.prefLoadedVersion,1);
 w.document.body.innerHTML=ui.renderSchedule();
 assert.ok(w.document.querySelector('[data-action="ess:plan-contract-save"]'));
 await ui.handle({dataset:{action:'ess:plan-contract-save'}});
 const change=calls.find(x=>x.name==='set_essential_worker_schedule_constraints');
 assert.equal(change.args.p_worker,'no-phone');
 assert.equal(change.args.p_version,1);
 assert.equal(change.args.p_min,25);assert.equal(change.args.p_max,40);
 assert.equal(calls.some(x=>x.name==='save_essential_shift'),false);
 await w.happyDOM.close();
});
