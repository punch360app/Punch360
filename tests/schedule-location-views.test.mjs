import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {buildScheduleView,weekStartIso,scheduleViewWindow,scheduleViewOptions} from '../web/live/schedule-location-views.js';
import {createPlanningController} from '../web/live/planning.js';

const location={id:'branch',name:'Établissement principal',active:true,timezone:'America/Toronto'};
const siteA={shift_id:'morning',client_site_id:'addressA',client_name:'Clinique Nadine',site_name:'Clinique',city:'Saint-Augustin-de-Desmaures',address_line:'123 rue Exemple'};
const siteB={shift_id:'afternoon',client_site_id:'addressB',client_name:'Condo Mathieu',site_name:'Appartement',city:'Charlesbourg',address_line:'456 avenue Test'};
const worker={id:'worker-a',name:'Alex',status:'active'};
const shifts=[
 {id:'morning',worker_id:'worker-a',location_id:'branch',department_id:'team',client_site_id:'addressA',starts_at:'2026-11-05T13:00:00Z',ends_at:'2026-11-05T17:00:00Z',timezone:'America/Toronto',version:2,cancelled_at:null,note:'Matin'},
 {id:'afternoon',worker_id:'worker-a',location_id:'branch',department_id:'team',client_site_id:'addressB',starts_at:'2026-11-05T18:00:00Z',ends_at:'2026-11-05T21:00:00Z',timezone:'America/Toronto',version:2,cancelled_at:null,note:'Après-midi'},
 {id:'coworker',worker_id:'worker-b',location_id:'branch',department_id:'team',client_site_id:'addressA',starts_at:'2026-11-05T14:00:00Z',ends_at:'2026-11-05T18:00:00Z',timezone:'America/Toronto',version:1,cancelled_at:null,note:'Collègue'},
 {id:'vacant',worker_id:null,location_id:'branch',department_id:'team',client_site_id:null,starts_at:'2026-11-05T19:00:00Z',ends_at:'2026-11-05T20:00:00Z',timezone:'America/Toronto',version:1,cancelled_at:null,note:''},
 {id:'tomorrow',worker_id:'worker-a',location_id:'branch',department_id:'team',client_site_id:null,starts_at:'2026-11-06T13:00:00Z',ends_at:'2026-11-06T17:00:00Z',timezone:'America/Toronto',version:1,cancelled_at:null,note:''}
];
const siteDetails=[siteA,siteB,{...siteA,shift_id:'coworker',client_site_id:'addressA'}];
const base={shifts,assignedSites:siteDetails,day:'2026-11-05',period:'day',workerName:id=>id==='worker-a'?'Alex':'Camille',branchName:()=>location.name};
test('client locations share one source of published shifts and sort by employee or address',()=>{
 const byEmployee=buildScheduleView({...base,mode:'employee'});
 const alex=byEmployee.groups.find(g=>g.title==='Alex');
 assert.ok(alex);
 assert.deepEqual(alex.shifts.map(x=>x.id),['morning','afternoon']);
 assert.equal(byEmployee.stats.shifts,4);
 assert.equal(byEmployee.stats.unassigned,1);
 assert.equal(byEmployee.stats.withoutClientSite,1);
 assert.equal(byEmployee.stats.overlappingShifts,0);
 const bySite=buildScheduleView({...base,mode:'site'});
 const clinic=bySite.groups.find(g=>g.title.includes('Clinique Nadine'));
 assert.ok(clinic);
 assert.equal(clinic.shifts.length,2);
 assert.equal(clinic.shifts[0].worker_id,'worker-a');
 assert.equal(clinic.shifts[1].worker_id,'worker-b');
 assert.equal(bySite.groups.some(x=>x.title.includes('Adresse client non attribuée')),true);
 assert.equal(bySite.stats.unassigned,1);
 assert.equal(shifts.some(x=>x.client_site_id==='addressA'),true);
});
test('date, week, department, client, address and worker filters are consistent',()=>{
 assert.equal(weekStartIso('2026-11-05'),'2026-11-02');
 assert.deepEqual(scheduleViewWindow('2026-11-05','day'),{from:'2026-11-05',to:'2026-11-06'});
 assert.deepEqual(scheduleViewWindow('2026-11-05','week'),{from:'2026-11-02',to:'2026-11-09'});
 assert.throws(()=>scheduleViewWindow('2026-11-51','day'),/invalide/);
 assert.throws(()=>scheduleViewWindow('2026-11-05','month'),/Période/);
 const week=buildScheduleView({...base,mode:'site',period:'week'});
 assert.equal(week.rows.length,5);
 const onlyMathieu=buildScheduleView({...base,mode:'site',client:'Condo Mathieu'});
 assert.deepEqual(onlyMathieu.rows.map(x=>x.id),['afternoon']);
 const onlySiteA=buildScheduleView({...base,mode:'site',site:'addressA'});
 assert.deepEqual(onlySiteA.rows.map(x=>x.id),['morning','coworker']);
 assert.equal(buildScheduleView({...base,mode:'employee',worker:'worker-b'}).rows.length,1);
 assert.equal(buildScheduleView({...base,mode:'site',department:'unrelated'}).rows.length,0);
 const opts=scheduleViewOptions(shifts,siteDetails);
 assert.deepEqual(opts.clients,['Clinique Nadine','Condo Mathieu']);
 assert.equal(opts.sites.length,2);
});
test('real UTC overlaps warn without penalizing two coworkers at same address or inventing travel times',()=>{
 const overlap={...shifts[1],id:'overlap',starts_at:'2026-11-05T16:00:00Z',ends_at:'2026-11-05T19:00:00Z'};
 const result=buildScheduleView({...base,mode:'employee',shifts:[shifts[0],overlap,shifts[2]]});
 assert.equal(result.stats.overlappingShifts,2);
 assert.equal(result.rows.find(x=>x.id==='morning').simultaneousConflict,true);
 assert.equal(result.rows.find(x=>x.id==='overlap').simultaneousConflict,true);
 assert.equal(result.rows.find(x=>x.id==='coworker').simultaneousConflict,false);
 const consecutive={...shifts[1],starts_at:'2026-11-05T17:00:00Z'};
 const noGap=buildScheduleView({...base,shifts:[shifts[0],consecutive],mode:'employee'});
 assert.equal(noGap.stats.overlappingShifts,0);
 assert.equal(noGap.stats.immediateChanges,2);
 assert.equal(noGap.rows.some(x=>x.simultaneousConflict),false);
});
test('manager can toggle two views and apply filters without another calendar or publishing',async()=>{
 const w=new Window();const calls=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});return{data:[]};},from(){return {}}};
 const ui=createPlanningController({sb,redraw(){},notify(){},escape:x=>String(x??'').replaceAll('&','&amp;'),document:w.document});
 Object.assign(ui.state,{company:'tenant',role:'boss',user:'manager',own:null,entitlement:{features:[]},locations:[location],
  departments:[{id:'team',location_id:'branch',name:'Entretien',active:true}],roster:[worker,{id:'worker-b',name:'Camille',status:'active'}],
  workers:[],assignedSites:siteDetails,shifts:[...shifts],tab:'calendar',showForm:false});
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Par employé/);
 assert.match(w.document.body.textContent,/Par emplacement/);
 assert.match(w.document.body.textContent,/Clinique Nadine/);
 const mode=w.document.getElementById('plan-calendarViewMode');mode.value='site';
 const period=w.document.getElementById('plan-calendarViewPeriod');period.value='day';
 const day=w.document.getElementById('plan-calendarViewDay');day.value='2026-11-05';
 await ui.handle({dataset:{action:'ess:plan-calendar-view-apply'}});
 assert.equal(ui.state.form.calendarViewMode,'site');
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Condo Mathieu/);
 assert.match(w.document.body.textContent,/Quarts affichés : 4/);
 assert.equal(calls.some(x=>/shift|schedule|punch|publish|client/.test(x.name)),false);
 await w.happyDOM.close();
});
test('employee cannot see manager grouping controls',async()=>{
 const w=new Window(),sb={rpc:async()=>({data:[]}),from(){return {}}};
 const ui=createPlanningController({sb,redraw(){},notify(){},escape:x=>String(x??''),document:w.document});
 Object.assign(ui.state,{company:'tenant',role:'employee',user:'employee',own:'worker-a',entitlement:{features:[]},locations:[location],
  departments:[],roster:[worker],workers:[],assignedSites:[siteA],shifts:[shifts[0]],tab:'calendar'});
 w.document.body.innerHTML=ui.renderSchedule();
 assert.equal(w.document.getElementById('plan-calendarViewMode'),null);
 await ui.handle({dataset:{action:'ess:plan-calendar-view-apply'}});
 assert.equal(ui.state.form.calendarViewMode,'employee');
 await w.happyDOM.close();
});
