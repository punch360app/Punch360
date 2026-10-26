import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlanningController} from '../web/live/planning.js';
import {locationAddressDraft,locationNavigationAddressArgs} from '../web/live/fixed-location-address.js';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const location={id:'location-a',company_id:'company-a',name:'Établissement principal',address:'123 rue A, Québec',
 timezone:'America/Toronto',address_components:{},navigation_address_version:1,
 punch_job_id:'unchanged-job',active:true};
function fixture(){
 const w=new Window();w.confirm=()=>true;
 const calls=[],notices=[],sites=[{...location}];
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_entitlements')return{data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return{data:[]};
  if(name==='list_essential_clients'||name==='list_essential_client_sites')return{data:{items:[],has_more:false}};
  if(name==='set_essential_location_navigation_address'){
   const loc=sites.find(x=>x.id===args.p_location&&x.company_id===args.p_company);
   if(!loc)return{error:{message:'Établissement inaccessible'}};
   if(loc.navigation_address_version!==args.p_expected_version)return{error:{message:'Adresse modifiée par un autre responsable'}};
   loc.address_components={line:args.p_address_line,unit:args.p_unit,city:args.p_city,region:args.p_region,postal_code:args.p_postal_code,country:args.p_country};
   loc.address=[args.p_address_line,args.p_unit,args.p_city,args.p_region,args.p_postal_code,args.p_country].filter(Boolean).join(', ');
   loc.navigation_address_version++;
   return {data:{id:loc.id,version:loc.navigation_address_version}};
  }
  return {data:[]};
 },from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
   then(resolve){return Promise.resolve({data:table==='essential_locations'?sites:[],error:null}).then(resolve)}};return q;}};
 const ui=createPlanningController({sb,document:w.document,redraw(){},notify(x){notices.push(x)},escape:e});
 return {w,ui,sites,calls,notices};
}
test('structured navigation address enforces version, country and independent GPS metadata',()=>{
 const previous={...location};
 const draft=locationAddressDraft(previous);
 assert.equal(draft.line,'123 rue A, Québec');
 assert.equal(draft.city,'');
 draft.line='123 rue des Érables';draft.city='Saint-Augustin-de-Desmaures';draft.unit='Bureau 3';
 draft.region='Québec';draft.postal_code='G3A 0A1';
 const args=locationNavigationAddressArgs('company-a',previous,draft);
 assert.equal(args.p_expected_version,1);assert.equal(args.p_country,'CA');
 assert.equal(Object.hasOwn(args,'punch_job_id'),false);
 assert.equal(Object.hasOwn(args,'latitude'),false);
 assert.equal(Object.hasOwn(args,'longitude'),false);
 assert.throws(()=>locationNavigationAddressArgs('company-a',previous,{...draft,city:''}),/Ville/);
 assert.throws(()=>locationNavigationAddressArgs('company-a',previous,{...draft,timezone:'not valid!?'}),/Fuseau/);
 assert.throws(()=>locationNavigationAddressArgs('company-a',{...previous,navigation_address_version:null},draft),/version/);
});
test('Boss edits existing location without creating another site, job, shift or changing GPS',async()=>{
 const {w,ui,calls,sites}=fixture();
 await ui.load({company_id:'company-a',role:'boss'},'boss',null,[]);
 w.document.body.innerHTML=ui.renderOrganization();
 assert.match(w.document.body.textContent,/Établissement principal/);
 const edit=w.document.querySelector('[data-action="ess:plan-location-address-edit"][data-id="location-a"]');
 assert.ok(edit);
 await ui.handle(edit);
 w.document.body.innerHTML=ui.renderOrganization();
 assert.match(w.document.body.textContent,/périmètre GPS ne changent pas/);
 for(const [id,value] of Object.entries({navLocLine:'123 rue des Érables',navLocUnit:'Suite 200',
  navLocCity:'Charlesbourg',navLocRegion:'QC',navLocPostal:'G1H 2B2',navLocCountry:'CA',navLocTimezone:'America/Toronto'}))
  w.document.getElementById('plan-'+id).value=value;
 await ui.handle({dataset:{action:'ess:plan-location-address-save'}});
 assert.equal(calls.filter(x=>x.name==='set_essential_location_navigation_address').length,1);
 assert.equal(sites.length,1);assert.equal(sites[0].punch_job_id,'unchanged-job');
 assert.equal(sites[0].navigation_address_version,2);
 assert.match(sites[0].address,/Charlesbourg/);
 assert.equal(calls.some(x=>/save_essential_location|save_essential_shift|punch_in|update_job/.test(x.name)),false);
 await w.happyDOM.close();
});
test('employee sees the authorized address but cannot change it or invoke the write RPC',async()=>{
 const {w,ui,calls}=fixture();
 await ui.load({company_id:'company-a',role:'employee'},'employee','worker-a',[]);
 w.document.body.innerHTML=ui.renderOrganization();
 assert.match(w.document.body.textContent,/123 rue A/);
 assert.equal(w.document.querySelector('[data-action="ess:plan-location-address-edit"]'),null);
 await ui.handle({dataset:{action:'ess:plan-location-address-edit',id:'location-a'}});
 assert.equal(calls.some(x=>x.name==='set_essential_location_navigation_address'),false);
 await w.happyDOM.close();
});
