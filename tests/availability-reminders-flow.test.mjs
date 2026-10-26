import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {nextIsoMonday,reminderSelection,reminderResultLabel} from '../web/live/availability-reminders.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const location={id:'location',name:'Atelier',timezone:'America/Toronto',active:true};
const department={id:'department',name:'Ventes',location_id:'location',active:true};
async function fixture(role='boss'){
 const window=new Window();window.confirm=()=>true;
 const calls=[],notices=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(name==='essential_entitlements')return {data:{features:['advanced_schedules','availability'],title:'Plus'}};
  if(name==='essential_team_roster'||name==='list_essential_shift_absences'||name==='list_essential_weekly_availability'||name==='list_essential_worker_schedule_preferences')return {data:[]};
  if(name==='essential_availability_shift_preview')return {data:{shifts:[]}};
  if(name==='essential_availability_reminder_batch')return {data:{total:3,with_declaration:1,without_account:1,already_sent:0,pending:1,sent:args.p_confirm?1:0,confirmed:args.p_confirm,channel:'internal',no_sms:true}};
  return {data:[]};
 },from(table){const query={select(){return query},eq(){return query},gt(){return query},lt(){return query},order(){return query},limit(){return query},
  then(resolve){return Promise.resolve({data:table==='essential_locations'?[location]:table==='essential_departments'?[department]:[],error:null}).then(resolve)}
 };return query;}};
 const ui=createPlanningController({sb,redraw(){},notify(message){notices.push(message)},escape,document:window.document});
 await ui.load({company_id:'company',role},'user',null,[]);
 ui.state.tab='availability';
 Object.assign(ui.state.form,{reminderWeek:'2026-11-02',reminderDue:'2026-11-02',reminderDepartment:'department'});
 return {ui,window,calls,notices};
}
test('Monday selection is ISO and deadline cannot exceed selected week',()=>{
 assert.equal(nextIsoMonday('2026-10-26'),'2026-10-26');
 assert.equal(nextIsoMonday('2026-10-27'),'2026-11-02');
 assert.deepEqual(reminderSelection({reminderWeek:'2026-11-02',reminderDue:'2026-11-05',reminderDepartment:''}),{p_week:'2026-11-02',p_due:'2026-11-05',p_department:null});
 assert.throws(()=>reminderSelection({reminderWeek:'2026-11-03',reminderDue:'2026-11-05'}),/lundi/);
 assert.throws(()=>reminderSelection({reminderWeek:'2026-11-02',reminderDue:'2026-11-10'}),/semaine/);
 assert.match(reminderResultLabel({pending:2,with_declaration:3,without_account:1,already_sent:4,sent:0,confirmed:false}),/À rappeler : 2/);
});
test('manager previews before confirmed internal send and cannot submit twice',async()=>{
 const {ui,window,calls}=await fixture();
 window.document.body.innerHTML=ui.renderSchedule();
 assert.match(window.document.body.textContent,/Demander les disponibilités de la semaine/);
 assert.equal(window.document.querySelectorAll('[data-action="ess:plan-reminder-send"]').length,0);
 await ui.handle({dataset:{action:'ess:plan-reminder-preview'}});
 let rem=calls.filter(c=>c.name==='essential_availability_reminder_batch');
 assert.equal(rem.length,1);assert.equal(rem[0].args.p_confirm,false);assert.equal(rem[0].args.p_company,'company');
 assert.equal(rem[0].args.p_department,'department');
 window.document.body.innerHTML=ui.renderSchedule();
 assert.match(window.document.body.textContent,/Sans compte accessible : 1/);
 assert.ok(window.document.querySelector('[data-action="ess:plan-reminder-send"]'));
 await ui.handle({dataset:{action:'ess:plan-reminder-send'}});
 rem=calls.filter(c=>c.name==='essential_availability_reminder_batch');
 assert.equal(rem.length,2);assert.equal(rem[1].args.p_confirm,true);
 assert.equal(rem[1].args.p_week,'2026-11-02');
 assert.equal(ui.state.reminderPreview.confirmed,true);
 window.document.body.innerHTML=ui.renderSchedule();
 assert.equal(window.document.querySelector('[data-action="ess:plan-reminder-send"]'),null);
 await ui.handle({dataset:{action:'ess:plan-reminder-send'}});
 assert.equal(calls.filter(c=>c.name==='essential_availability_reminder_batch').length,2);
 await window.happyDOM.close();
});
test('changed deadline invalidates a preview; employee never sees manager reminders',async()=>{
 const {ui,window,calls}=await fixture();
 window.document.body.innerHTML=ui.renderSchedule();
 await ui.handle({dataset:{action:'ess:plan-reminder-preview'}});
 window.document.body.innerHTML=ui.renderSchedule();
 window.document.getElementById('plan-reminderDue').value='2026-11-03';
 await ui.handle({dataset:{action:'ess:plan-reminder-send'}});
 assert.equal(calls.filter(c=>c.name==='essential_availability_reminder_batch').length,1);
 await window.happyDOM.close();
 const employee=await fixture('employee');
 employee.window.document.body.innerHTML=employee.ui.renderSchedule();
 assert.doesNotMatch(employee.window.document.body.textContent,/Demander les disponibilités de la semaine/);
 await employee.ui.handle({dataset:{action:'ess:plan-reminder-preview'}});
 assert.equal(employee.calls.some(c=>c.name==='essential_availability_reminder_batch'),false);
 await employee.window.happyDOM.close();
});
