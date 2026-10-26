import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {buildMultiSiteOverview,overviewRange} from '../web/live/multi-site-overview.js';
import {createPlanningController} from '../web/live/planning.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const make=(id,worker,from,to,site,department='dept')=>({id,worker_id:worker,company_id:'tenant',
 starts_at:'2026-11-02T'+from+':00Z',ends_at:'2026-11-02T'+to+':00Z',
 timezone:'America/Toronto',department_id:department,client_site_id:site,version:1});
const shifts=[
 make('a','nadine','13:00','17:00','address-a'),
 make('b','nadine','18:00','21:00','address-b'),
 make('c','mathieu','13:00','21:00','address-b'),
 make('d','nadine','16:00','18:00','address-b'),
 make('e',null,'15:00','18:00',null),
 {...make('cancelled','nadine','14:00','16:00','address-a'),cancelled_at:'2026-10-30T00:00:00Z'}
];
const sites=[
 {shift_id:'a',client_site_id:'address-a',client_name:'Clinique Nadine',site_name:'St-Augustin',city:'Saint-Augustin-de-Desmaures',address_line:'123 Rue A'},
 {shift_id:'b',client_site_id:'address-b',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Charlesbourg',address_line:'500 Rue B'},
 {shift_id:'c',client_site_id:'address-b',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Charlesbourg',address_line:'500 Rue B'},
 {shift_id:'d',client_site_id:'address-b',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Charlesbourg',address_line:'500 Rue B'}
];
const roster=[{id:'nadine',name:'Nadine',status:'active'},{id:'mathieu',name:'Mathieu',status:'active'}];
test('one schedule changes grouping without changing shifts, clients or hours',()=>{
 const employee=buildMultiSiteOverview({day:'2026-11-02',shifts,assignedSites:sites,roster,view:'employee'});
 const location=buildMultiSiteOverview({day:'2026-11-02',shifts,assignedSites:sites,roster,view:'location'});
 assert.equal(employee.shown,5);assert.equal(location.shown,5);
 assert.equal(employee.noWorker,1);assert.equal(location.noSite,1);
 assert.equal(employee.overlapShifts,2);assert.equal(location.overlapShifts,2);
 assert.equal(employee.groups.find(g=>g.label==='Nadine').items.length,3);
 assert.equal(location.groups.find(g=>g.label.includes('Condo Mathieu')).items.length,3);
 assert.equal(location.groups.find(g=>g.label.includes('Condo Mathieu')).items.filter(x=>x.workerName==='Mathieu').length,1);
 assert.equal(location.groups.find(g=>g.label.includes('Adresse d’intervention non affectée')).items.length,1);
 assert.equal(location.groups.some(g=>g.label==='Nadine'),false);
 assert.equal(shifts[0].client_site_id,'address-a');
});
test('overlap detection is per worker, cancelled shifts ignored, travel estimates never manufactured',()=>{
 const res=buildMultiSiteOverview({day:'2026-11-02',shifts,assignedSites:sites,roster,view:'employee'});
 const nadine=res.groups.find(g=>g.label==='Nadine').items;
 assert.deepEqual(nadine.filter(x=>x.overlap).map(x=>x.id),['a','d']);
 const separate=buildMultiSiteOverview({day:'2026-11-02',shifts:[shifts[0],shifts[1]],assignedSites:[sites[0],sites[1]],roster});
 assert.equal(separate.travelCheckShifts,2,'one hour between two distinct clients merits human review');
 assert.equal(Object.hasOwn(res,'travelKilometers'),false);
 const filtered=buildMultiSiteOverview({day:'2026-11-02',shifts,assignedSites:sites,roster,site:'address-a'});
 assert.equal(filtered.shown,1);assert.equal(filtered.overlapShifts,1);
 assert.equal(filtered.groups[0].items[0].overlap,true);
 const week=overviewRange('2026-11-05','week');
 assert.deepEqual(week,{from:'2026-11-02',to:'2026-11-08'});
 assert.throws(()=>overviewRange('2026-13-33'),/Jour et période/);
});
test('overnight shifts appear on both days, without phantom assignments',()=>{
 const overnight=[{...make('overnight','nadine','23:00','23:30',null),ends_at:'2026-11-03T08:00:00Z'}];
 const monday=buildMultiSiteOverview({day:'2026-11-02',shifts:overnight,assignedSites:[],roster});
 const tuesday=buildMultiSiteOverview({day:'2026-11-03',shifts:overnight,assignedSites:[],roster});
 assert.equal(monday.shown,1);assert.equal(tuesday.shown,1);
 assert.equal(monday.noSite,1);assert.equal(tuesday.noSite,1);
});
test('real Web controller switches employee/place views only for boss/admin',async()=>{
 const win=new Window(),calls=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});return {data:[]}},from(){throw Error('No SQL access needed to render this manager view')}};
 const ui=createPlanningController({sb,document:win.document,redraw(){},notify(){},escape:esc});
 Object.assign(ui.state,{company:'tenant',user:'boss',role:'boss',entitlement:{features:[]},shifts,assignedSites:sites,roster,departments:[{id:'dept',name:'Housekeeping',active:true}],locations:[],own:null});
 Object.assign(ui.state.form,{overviewDay:'2026-11-02',overviewPeriod:'day'});
 win.document.body.innerHTML=ui.renderSchedule();
 assert.match(win.document.body.textContent,/Calendrier des interventions/);
 assert.match(win.document.body.textContent,/Par employé/);
 assert.match(win.document.body.textContent,/chevauchement/);
 await ui.handle({dataset:{action:'ess:plan-overview-view',id:'location'}});
 assert.equal(ui.state.form.overviewView,'location');
 win.document.body.innerHTML=ui.renderSchedule();
 assert.match(win.document.body.textContent,/Condo Mathieu/);
 assert.equal(calls.length,0,'switch is read-only');
 ui.state.role='employee';
 assert.doesNotMatch(ui.renderSchedule(),/Calendrier des interventions/);
 await win.happyDOM.close();
});
