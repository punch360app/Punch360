import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {navigationStopChoices,navigationStopDestination} from '../web/live/navigation-choices.js';
import {assignedSiteForShift,assignedSiteAddress,assignedSiteMapsUrl,assignedSiteSummary,shiftSiteAssignmentArgs} from '../web/live/shift-client-sites.js';

const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc={id:'branch',name:'Établissement principal',timezone:'America/Toronto',active:true};
const visitA={id:'site-a',name:'Visite Nadine',client_name:'Clinique Sourire',client_id:'client-a',
  address_line:'123 rue des Érables',unit:'Suite 201',city:'Saint-Augustin-de-Desmaures',
  region:'QC',postal_code:'G3A 0A1',country:'CA',timezone:'America/Toronto',active:true};
const visitB={...visitA,id:'site-b',name:'Visite Mathieu',client_name:'Condo Mathieu',
 address_line:'456 avenue Royale',unit:'',city:'Charlesbourg',postal_code:'G1H 0A1'};
const a={id:'shift-a',company_id:'tenant',worker_id:'worker',location_id:'branch',department_id:null,
 starts_at:'2026-11-05T13:00:00Z',ends_at:'2026-11-05T17:00:00Z',timezone:'America/Toronto',
 client_site_id:'site-a',version:2,note:'Entretien matin',cancelled_at:null};
const b={...a,id:'shift-b',starts_at:'2026-11-05T18:00:00Z',ends_at:'2026-11-05T21:00:00Z',
 client_site_id:'site-b',version:2,note:'Entretien après-midi'};
function setup(role='boss'){
 const w=new Window();w.confirm=()=>true;
 const calls=[],shifts=[{...a},{...b}],visits=[visitA,visitB];
 const siteFor=(sh)=>{const site=visits.find(v=>v.id===sh.client_site_id);return site?{shift_id:sh.id,starts_at:sh.starts_at,
  client_site_id:sh.client_site_id,site_name:site.name,client_name:site.client_name,
  address_line:site.address_line,unit:site.unit,city:site.city,region:site.region,postal_code:site.postal_code,
  country:site.country,client_timezone:site.timezone,contact_name:'Nadine',access_instructions:'Entrée arrière',
  internal_notes:'SECRET-NO-EMPLOYEE'}:null;};
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(name==='essential_entitlements')return {data:{title:'Essentiel',features:[]}};
  if(name==='essential_team_roster')return {data:[{id:'worker',name:'Alex',status:'active'}]};
  if(name==='list_essential_clients')return {data:{items:[],has_more:false}};
  if(name==='list_essential_client_sites')return {data:{items:visits.filter(v=>String(v.name+' '+v.client_name+' '+v.city).toLowerCase().includes((args.p_search||'').toLowerCase())),has_more:false}};
  if(name==='list_essential_assigned_client_sites')return {data:{items:shifts.map(siteFor).filter(Boolean),has_more:false}};
  if(name==='set_essential_shift_client_site'){
   const shift=shifts.find(v=>v.id===args.p_shift);
   if(!shift)return{error:{message:'Quart absent'}};
   if(shift.version!==args.p_expected_version)return{error:{message:'Version modifiée'}};
   shift.client_site_id=args.p_site;shift.version++;
   return {data:{shift_id:shift.id,version:shift.version,unchanged:false,notified:true}};
  }
  return {data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
  then(resolve){const data=table==='essential_locations'?[loc]:table==='scheduled_shifts'?shifts:[];return Promise.resolve({data,error:null}).then(resolve)}};
  return q;}};
 const ui=createPlanningController({sb,document:w.document,escape,redraw(){},notify(){}});
 return {ui,w,calls,shifts};
}
test('two shifts in one day retain independent, geolocatable client addresses and safe Maps itinerary',()=>{
 const two=[{shift_id:'shift-a',...visitA,site_name:visitA.name},{shift_id:'shift-b',...visitB,site_name:visitB.name}];
 assert.equal(assignedSiteForShift(two,'shift-a').city,'Saint-Augustin-de-Desmaures');
 assert.equal(assignedSiteForShift(two,'shift-b').city,'Charlesbourg');
 assert.equal(assignedSiteForShift(two,'none'),null);
 assert.match(assignedSiteAddress(visitA),/123 rue des Érables, Suite 201, Saint-Augustin/);
 assert.match(assignedSiteSummary(two[1]),/Condo Mathieu/);
 const url=assignedSiteMapsUrl(visitB);
 assert.ok(url.startsWith('https://www.google.com/maps/search/?api=1&query='));
 assert.match(decodeURIComponent(url),/Charlesbourg/);
 assert.throws(()=>assignedSiteMapsUrl({}),/adresse/);
 assert.deepEqual(shiftSiteAssignmentArgs('tenant',a,'site-b'),
   {p_company:'tenant',p_shift:'shift-a',p_site:'site-b',p_expected_version:2});
 assert.equal(shiftSiteAssignmentArgs('tenant',a,'').p_site,null);
});
test('manager assigns a searched client site to the existing quarter without editing hours or creating a punch',async()=>{
 const {ui,w,calls,shifts}=setup('boss');
 await ui.load({company_id:'tenant',role:'boss'},'boss-user','worker',[]);
 ui.state.tab='calendar';ui.state.showForm=false;
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Saint-Augustin-de-Desmaures/);
 assert.match(w.document.body.textContent,/Charlesbourg/);
 assert.match(w.document.body.textContent,/Itinéraire/);
 assert.doesNotMatch(w.document.body.innerHTML,/SECRET-NO-EMPLOYEE/);
 assert.ok(w.document.querySelector('[data-action="ess:plan-site-open"]'));
 await ui.handle({dataset:{action:'ess:plan-site-open',id:'shift-a'}});
 w.document.body.innerHTML=ui.renderSchedule();
 assert.ok(w.document.getElementById('plan-clientSiteChoice'));
 w.document.getElementById('plan-clientSiteChoice').value='site-b';
 const originalStart=shifts[0].starts_at,originalEnd=shifts[0].ends_at;
 await ui.handle({dataset:{action:'ess:plan-site-assign',id:'shift-a'}});
 const assignment=calls.find(c=>c.name==='set_essential_shift_client_site');
 assert.deepEqual(assignment.args,{p_company:'tenant',p_shift:'shift-a',p_site:'site-b',p_expected_version:2});
 assert.equal(shifts[0].client_site_id,'site-b');
 assert.equal(shifts[0].version,3);
 assert.equal(shifts[0].starts_at,originalStart);
 assert.equal(shifts[0].ends_at,originalEnd);
 assert.equal(calls.some(c=>/punch|save_essential_local_shift|publish|create_job/.test(c.name)),false);
 await w.happyDOM.close();
});
test('employee sees own assigned address but cannot change its client site',async()=>{
 const {ui,w,calls}=setup('employee');
 await ui.load({company_id:'tenant',role:'employee'},'employee','worker',[]);
 ui.state.tab='calendar';ui.state.showForm=false;
 w.document.body.innerHTML=ui.renderSchedule();
 assert.match(w.document.body.textContent,/Clinique Sourire/);
 assert.match(w.document.body.textContent,/Condo Mathieu/);
 assert.doesNotMatch(w.document.body.textContent,/Associer une adresse client/);
 await ui.handle({dataset:{action:'ess:plan-site-open',id:'shift-a'}});
 assert.equal(calls.some(c=>c.name==='set_essential_shift_client_site'),false);
 assert.match(ui.state.error,/Responsable requis/);
 await w.happyDOM.close();
});

test('every published customer stop has independently chosen route options, never mixed or silently reordered',async()=>{
 const {ui,w,calls,shifts}=setup('employee');
 await ui.load({company_id:'tenant',role:'employee'},'employee','worker',[]);
 ui.state.tab='calendar';ui.state.showForm=false;
 w.document.body.innerHTML=ui.renderSchedule();
 const html=w.document.body.innerHTML;
 const wazeLinks=[...w.document.querySelectorAll('a[href*="waze.com/ul"]')];
 assert.equal(wazeLinks.length,2);
 const destinations=wazeLinks.map(a=>new URL(a.href).searchParams.get('q'));
 assert.equal(destinations[0].includes('Saint-Augustin-de-Desmaures'),true);
 assert.equal(destinations[1].includes('Charlesbourg'),true);
 const googleLinks=[...w.document.querySelectorAll('a[href*="google.com/maps/dir"]')];
 assert.equal(googleLinks.length,2);
 assert.match(html,/Choisir une application d’itinéraire/);
 assert.doesNotMatch(html,/SECRET-NO-EMPLOYEE/);
 assert.equal(calls.some(x=>/punch_|save_essential_shift|send_notification/.test(x.name)),false);
 assert.equal(shifts[0].id,'shift-a');
 assert.equal(shifts[1].id,'shift-b');
 await w.happyDOM.close();
});
test('single destination per stop obeys mobile compatibility and never includes codes or contact info in map links',()=>{
 const stop={shift_id:'morning',client_site_id:'client-site',client_name:'Clinique',
  site_name:'Entretien',address_line:'123 rue des Érables',unit:'Appartement #7',city:'Québec',
  region:'QC',postal_code:'G1K 1A1',country:'CA',internal_notes:'PASSWORD-VERY-PRIVATE',
  contact_name:'Confidential',access_instructions:'Code 9999'};
 const dest=navigationStopDestination(stop);
 assert.equal(dest.shiftId,'morning');
 assert.equal(dest.address.includes('Appartement #7'),true);
 assert.equal(Object.keys(dest).includes('internal_notes'),false);
 const android=navigationStopChoices(stop,'android');
 const ios=navigationStopChoices(stop,'ios');
 assert.deepEqual(android.map(x=>x.id),['google','waze','other']);
 assert.deepEqual(ios.map(x=>x.id),['google','waze','apple']);
 for(const item of [...android,...ios]){
  assert.doesNotMatch(item.url,/PASSWORD|Confidential|9999/);
  assert.equal(decodeURIComponent(item.url).includes('Québec'),true);
 }
 assert.equal(navigationStopDestination({...stop,city:''}),null);
 assert.equal(navigationStopChoices({...stop,client_site_id:null},'ios').length,0);
});

test('client access instructions are absent from default DOM and require a permitted explicit tap',async()=>{
 const {ui,w,calls}=setup('employee');
 await ui.load({company_id:'tenant',role:'employee'},'employee','worker',[]);
 ui.state.tab='calendar';ui.state.showForm=false;
 let html=ui.renderSchedule();
 assert.doesNotMatch(html,/Entrée arrière/);
 assert.match(html,/Voir les consignes et le contact/);
 assert.equal(ui.state.accessShiftId,null);
 await ui.handle({dataset:{action:'ess:plan-site-access-toggle',id:'shift-a'}});
 assert.equal(ui.state.accessShiftId,'shift-a');
 html=ui.renderSchedule();
 assert.match(html,/Entrée arrière/);
 assert.match(html,/Contact sur place : Nadine/);
 assert.doesNotMatch(html,/SECRET-NO-EMPLOYEE/);
 await ui.handle({dataset:{action:'ess:plan-site-access-toggle',id:'shift-a'}});
 assert.equal(ui.state.accessShiftId,null);
 assert.doesNotMatch(ui.renderSchedule(),/Entrée arrière/);
 await ui.handle({dataset:{action:'ess:plan-site-access-toggle',id:'foreign-shift'}});
 assert.match(ui.state.error,/non autorisées/);
 assert.equal(ui.state.accessShiftId,null);
 assert.equal(calls.filter(x=>/punch|payment|gps|geofence/i.test(x.name)).length,0);
 await w.happyDOM.close();
});
test('leaving company workspace erases any previously expanded site access details',async()=>{
 const {ui,w}=setup('employee');
 await ui.load({company_id:'tenant',role:'employee'},'employee','worker',[]);
 await ui.handle({dataset:{action:'ess:plan-site-access-toggle',id:'shift-a'}});
 assert.equal(ui.state.accessShiftId,'shift-a');
 ui.reset();
 assert.equal(ui.state.accessShiftId,null);
 await w.happyDOM.close();
});
