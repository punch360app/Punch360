import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {parseWeekdays,weeklyArgs,weeklyDaysLabel,weeklyPreviewLabel} from '../web/live/weekly-availability.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ent={features:['availability','advanced_schedules'],title:'Essentiel Plus'};
const site={id:'site-a',name:'Atelier',active:true,timezone:'America/Toronto'};
const noPhone={id:'no-phone',first_name:'Sans',last_name:'Téléphone',status:'active',personal_access:false};
function setup(role='employee'){
 const w=new Window();w.confirm=()=>true;const calls=[],notices=[],rules=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(name==='essential_entitlements')return {data:ent};
  if(name==='essential_team_roster')return {data:[{id:'owner',name:'Émilie',status:'active'}]};
  if(name==='list_essential_shift_absences')return {data:[]};
  if(name==='list_essential_weekly_availability')return {data:rules};
  if(name==='essential_availability_shift_preview')return {data:{shifts:[{shift_id:'shift',worker_id:'owner',starts_at:new Date().toISOString(),status:'unknown',source:'no_rule',conflict:false}]}};
  if(name==='save_essential_weekly_availability'){
   rules.push({id:'rule',worker_id:args.p_worker,location_id:args.p_location,days:args.p_days,starts_local:args.p_start,ends_local:args.p_end,effective_from:args.p_from,effective_until:args.p_until,available:args.p_available,version:1});
   return {data:{id:'rule',version:1,conflicts:0}};
  }
  if(name==='remove_essential_weekly_availability'){rules.length=0;return {data:true};}
  if(name==='personal_calendar_feed_status')return {data:{active:false}};
  return {data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:table==='essential_locations'?[site]:[],error:null}).then(resolve)}};return q;}};
 const ui=createPlanningController({sb,redraw(){},notify(x){notices.push(x)},escape,document:w.document});
 Object.assign(ui.state,{company:'company-a',user:role==='boss'?'boss-a':'employee-a',own:role==='boss'?null:'owner',role,
 entitlement:ent,workers:[noPhone],roster:[{id:'owner',name:'Émilie',status:'active'}],
 locations:[site],scopes:[],availability:[],weeklyRules:rules,weeklyPreview:[],weeklyUnavailable:false,tab:'availability'});
 Object.assign(ui.state.form,{weeklyLocation:'site-a',weeklyWorker:role==='boss'?'no-phone':'',weeklyDays:'1,2,3,4,5',weeklyStart:'07:00',weeklyEnd:'15:00',
  weeklyFrom:'2026-11-02',weeklyUntil:'',weeklyAvailable:'true',calendarFrom:'2026-11-01',calendarTo:'2026-12-01'});
 return {w,ui,calls,notices,rules};
}
test('weekdays and separate windows validate without guessing availability',()=>{
 assert.deepEqual(parseWeekdays('5,1,3'),[1,3,5]);
 for(const bad of ['','0','8','1,1','1,a'])assert.throws(()=>parseWeekdays(bad));
 assert.throws(()=>weeklyArgs({weeklyDays:'1',weeklyStart:'22:00',weeklyEnd:'06:00',weeklyFrom:'2026-11-02',weeklyAvailable:'true',weeklyLocation:'site'},'worker','req'),/deux plages/);
 assert.equal(weeklyDaysLabel([1,5]),'Lun, Ven');
 assert.equal(weeklyPreviewLabel({status:'unknown'}),'Inconnu');
});
test('employee can save a persistent week type and see server preview; no schedule mutation',async()=>{
 const {w,ui,calls,rules}=setup();
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Ma semaine type/);
 assert.match(w.document.body.textContent,/Inconnu/);
 assert.ok(w.document.querySelector('[data-action="ess:plan-weekly-save"]'));
 await ui.handle({dataset:{action:'ess:plan-weekly-save'}});
 const saves=calls.filter(c=>c.name==='save_essential_weekly_availability');
 assert.equal(saves.length,1);
 assert.equal(saves[0].args.p_worker,'owner');
 assert.deepEqual(saves[0].args.p_days,[1,2,3,4,5]);
 assert.equal(saves[0].args.p_available,true);
 assert.ok(saves[0].args.p_request);
 assert.equal(rules.length,1);
 assert.equal(calls.some(x=>x.name.includes('shift')&&x.name!=='essential_availability_shift_preview'),false);
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Règles actives/);
 assert.match(w.document.body.textContent,/Lun, Mar, Mer, Jeu, Ven/);
 await w.happyDOM.close();
});
test('manager may set a no-phone worker schedule; rules remain company and version scoped',async()=>{
 const {w,ui,calls}=setup('boss');
 w.document.body.innerHTML=ui.renderSchedule();
 const worker=w.document.getElementById('plan-weeklyWorker');
 assert.ok(worker&&worker.value==='no-phone');
 await ui.handle({dataset:{action:'ess:plan-weekly-save'}});
 const save=calls.find(x=>x.name==='save_essential_weekly_availability');
 assert.equal(save.args.p_worker,'no-phone');
 assert.equal(save.args.p_company,'company-a');
 assert.equal(save.args.p_location,'site-a');
 w.document.body.innerHTML=ui.renderSchedule();
 await ui.handle({dataset:{action:'ess:plan-weekly-remove',id:'rule',version:'1'}});
 const removed=calls.find(x=>x.name==='remove_essential_weekly_availability');
 assert.deepEqual(removed.args,{p_id:'rule',p_version:1});
 await w.happyDOM.close();
});
