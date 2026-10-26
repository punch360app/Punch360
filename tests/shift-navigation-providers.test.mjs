import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {assignedSiteNavigationChoices} from '../web/live/shift-client-sites.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
const a={id:'shift-a',company_id:'tenant',worker_id:'nadine',location_id:'branch',department_id:null,
 starts_at:tomorrow+'T13:00:00Z',ends_at:tomorrow+'T17:00:00Z',timezone:'America/Toronto',
 client_site_id:'site-a',version:1,note:'',cancelled_at:null};
const b={...a,id:'shift-b',starts_at:tomorrow+'T18:00:00Z',ends_at:tomorrow+'T21:00:00Z',client_site_id:'site-b'};
const visits=[
 {shift_id:'shift-a',client_site_id:'site-a',client_name:'Nadine',site_name:'Saint-Augustin',worker_id:'nadine',
  address_line:'123 rue des Érables',unit:'Apt #3',city:'Saint-Augustin-de-Desmaures',region:'QC',postal_code:'G3A 0A1',country:'CA',
  access_instructions:'Entrée #A',internal_notes:'SECRET NO URL'},
 {shift_id:'shift-b',client_site_id:'site-b',client_name:'Mathieu',site_name:'Charlesbourg',worker_id:'nadine',
  address_line:'456 avenue Royale',unit:'',city:'Charlesbourg',region:'QC',postal_code:'G1H 0A1',country:'CA',
  access_instructions:'Contacter bureau',internal_notes:'NEVER SHARE PRIVATE NOTE'}
];
test('each client has an independently encoded one-stop route and no private instructions leak into providers',()=>{
 const first=assignedSiteNavigationChoices(visits[0],'ios'),second=assignedSiteNavigationChoices(visits[1],'ios');
 assert.deepEqual(first.map(p=>p.id),['google','waze','apple']);
 assert.deepEqual(assignedSiteNavigationChoices(visits[0],'android').map(p=>p.id),['google','waze','other']);
 assert.equal(new URL(first[0].url).searchParams.get('destination'),
  '123 rue des Érables, Apt #3, Saint-Augustin-de-Desmaures, QC, G3A 0A1, CA');
 assert.equal(new URL(second[0].url).searchParams.get('destination'),
  '456 avenue Royale, Charlesbourg, QC, G1H 0A1, CA');
 assert.equal(new URL(first[1].url).searchParams.get('q'),
  '123 rue des Érables, Apt #3, Saint-Augustin-de-Desmaures, QC, G3A 0A1, CA');
 assert.equal(first[2].url.startsWith('https://maps.apple.com/?daddr='),true);
 assert.notEqual(first[0].url,second[0].url);
 for(const choice of [...first,...second])assert.doesNotMatch(choice.url,/SECRET|PRIVATE NOTE|Entrée|Contacter bureau/);
 assert.deepEqual(assignedSiteNavigationChoices({},'android'),[]);
});
test('employee schedule offers one voluntary route per published stop, without RPC calls that change Punch',async()=>{
 const w=new Window(),calls=[];
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_entitlements')return{data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return{data:[{id:'nadine',name:'Nadine',status:'active'}]};
  if(name==='list_essential_assigned_client_sites')return{data:{items:visits,has_more:false}};
  return{data:[]};
 },from(table){
  const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
   then(resolve){return Promise.resolve({data:table==='essential_locations'?[{id:'branch',company_id:'tenant',name:'Atelier',timezone:'America/Toronto',active:true}]:
    table==='scheduled_shifts'?[a,b]:[],error:null}).then(resolve)}
  };return q;
 }};
 const ui=createPlanningController({sb,document:w.document,escape,redraw(){},notify(){}});
 Object.assign(ui.state.form,{calendarFrom:tomorrow,calendarTo:new Date(Date.parse(tomorrow+'T00:00:00Z')+86400000).toISOString().slice(0,10)});
 await ui.load({company_id:'tenant',role:'employee'},'nadine-user','nadine',[]);
 ui.state.tab='calendar';
 w.document.body.innerHTML=ui.renderSchedule();
 const routes=[...w.document.querySelectorAll('details a[href*="maps"],details a[href*="waze"]')];
 assert.equal(routes.length,4,'two stops each provide Google and Waze links on generic web');
 assert.equal(routes.filter(el=>el.href.includes('waze.com')).length,2);
 assert.equal(routes.filter(el=>el.href.includes('maps/dir')).length,2);
 assert.match(w.document.body.innerHTML,/Saint-Augustin/);
 assert.match(w.document.body.innerHTML,/Charlesbourg/);
 assert.doesNotMatch(w.document.body.innerHTML,/SECRET NO URL|NEVER SHARE PRIVATE NOTE/);
 assert.equal(calls.filter(call=>/punch|gps|geofence|billing|save_essential/.test(call.name)).length,0);
 await w.happyDOM.close();
});
