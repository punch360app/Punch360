import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createClientDirectoryController,blankClient,blankSite,clientSaveArgs,siteSaveArgs,siteAddress} from '../web/live/client-directory.js';
import {createPlanningController} from '../web/live/planning.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixtures(){
 const w=new Window();w.confirm=()=>true;
 const calls=[],clients=[],sites=[],notifications=[];
 const rpc=async(name,args)=>{
  calls.push({name,args});
  if(name==='list_essential_clients'||name==='list_essential_client_sites'){
   const rows=name==='list_essential_clients'?clients:sites;
   const search=String(args.p_search||'').toLowerCase();
   const filtered=rows.filter(x=>x.company_id===args.p_company&&(!args.p_after||x.id>args.p_after)
    &&(!search||[x.name,x.reference,x.city,x.address_line,x.client_name].some(y=>String(y||'').toLowerCase().includes(search)))).sort((a,b)=>a.id.localeCompare(b.id));
   return {data:{items:filtered.slice(0,args.p_limit),has_more:filtered.length>args.p_limit}};
  }
  if(name==='save_essential_client'){
   const entry=args.p_id?clients.find(x=>x.id===args.p_id):null;
   if(entry&&entry.version!==args.p_expected_version)return{error:{message:'Fiche modifiée. Actualisez.'}};
   const id=args.p_id||'client-'+String(clients.length+1).padStart(3,'0');
   if(entry)Object.assign(entry,{name:args.p_name,active:args.p_active,reference:args.p_reference,version:entry.version+1});
   else clients.push({id,company_id:args.p_company,name:args.p_name,reference:args.p_reference,active:args.p_active,version:1});
   return {data:{id,version:entry?.version||1}};
  }
  if(name==='save_essential_client_site'){
   const entry=args.p_id?sites.find(x=>x.id===args.p_id):null;
   if(entry&&entry.version!==args.p_expected_version)return{error:{message:'Lieu modifié. Actualisez.'}};
   const id=args.p_id||'site-'+String(sites.length+1).padStart(3,'0');
   const client=clients.find(c=>c.id===args.p_client);
   const persisted={id,company_id:args.p_company,client_id:args.p_client,client_name:client?.name,
    name:args.p_name,address_line:args.p_address_line,unit:args.p_unit,city:args.p_city,
    region:args.p_region,postal_code:args.p_postal_code,country:args.p_country,
    timezone:args.p_timezone,latitude:args.p_latitude,longitude:args.p_longitude,
    contact_name:args.p_contact_name,contact_phone:args.p_contact_phone,
    access_instructions:args.p_access_instructions,internal_notes:args.p_internal_notes,
    active:args.p_active,version:entry?entry.version+1:1};
   if(entry)Object.assign(entry,persisted);
   else sites.push(persisted);
   return {data:{id,version:entry?.version||1}};
  }
  if(name==='essential_entitlements')return{data:{features:[],title:'Essentiel'}};
  if(name==='essential_team_roster')return{data:[]};
  return {data:[]};
 };
 const sb={rpc,from(table){const q={select(){return q},eq(){return q},gt(){return q},lt(){return q},order(){return q},limit(){return q},
  then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q;}};
 return {w,sb,calls,clients,sites,notifications};
}
test('client and place validation accepts addresses with no geocoding and rejects partial GPS',()=>{
 const data=siteSaveArgs('company',{...blankSite(),client_id:'client',name:'Centre',address_line:'123 rue du Marché',
  city:'Charlesbourg',timezone:'America/Toronto'},null);
 assert.equal(data.p_latitude,null);assert.equal(data.p_longitude,null);assert.equal(data.p_country,'CA');
 assert.throws(()=>siteSaveArgs('company',{...blankSite(),client_id:'client',name:'Centre',address_line:'123 rue du Marché',
  city:'Charlesbourg',latitude:'46.8'},null),/toutes les deux/);
 assert.throws(()=>siteSaveArgs('company',{...blankSite(),client_id:'client',name:'Centre',address_line:'123 rue du Marché',
  city:'Charlesbourg',latitude:'96',longitude:'-71'},null),/hors limites/);
 assert.equal(clientSaveArgs('company',{...blankClient(),name:'Maison propre'},null).p_name,'Maison propre');
});
test('client directory creates and edits a client + several visit addresses independently of branches',async()=>{
 const {w,sb,calls,clients,sites}=fixtures();
 const controller=createClientDirectoryController({sb,document:w.document,escape:esc,redraw(){},notify(){}});
 await controller.load('company-a');
 w.document.body.innerHTML=controller.render();
 assert.match(w.document.body.textContent,/distincts des établissements/);
 await controller.handle('new-client',{dataset:{}});
 w.document.body.innerHTML=controller.render();
 w.document.getElementById('directory-client-name').value='Clinique du Quartier';
 w.document.getElementById('directory-client-reference').value='CL-10';
 await controller.handle('save-client',{dataset:{}});
 assert.equal(clients.length,1);
 assert.equal(clients[0].name,'Clinique du Quartier');
 await controller.handle('new-site',{dataset:{id:clients[0].id}});
 w.document.body.innerHTML=controller.render();
 for(const [key,val] of Object.entries({name:'Visite Nadine',address_line:'123 rue des Érables',unit:'Bureau 2',
 city:'Saint-Augustin-de-Desmaures',region:'QC',postal_code:'G3A 1B2',timezone:'America/Toronto'}))
  w.document.getElementById('directory-site-'+key).value=val;
 await controller.handle('save-site',{dataset:{}});
 assert.equal(sites.length,1);assert.equal(sites[0].unit,'Bureau 2');
 assert.match(siteAddress(sites[0]),/Saint-Augustin-de-Desmaures/);
 await controller.handle('new-site',{dataset:{id:clients[0].id}});
 w.document.body.innerHTML=controller.render();
 for(const [key,val] of Object.entries({name:'Visite Mathieu',address_line:'456 boulevard de l’Ormière',
 city:'Charlesbourg',region:'QC'}))w.document.getElementById('directory-site-'+key).value=val;
 await controller.handle('save-site',{dataset:{}});
 assert.equal(sites.length,2);
 assert.equal(calls.some(x=>x.name.includes('shift')||x.name.includes('punch')||x.name==='save_essential_location'),false);
 await controller.handle('edit-site',{dataset:{id:sites[0].id}});
 w.document.body.innerHTML=controller.render();
 w.document.getElementById('directory-site-unit').value='Bureau 3';
 await controller.handle('save-site',{dataset:{}});
 assert.equal(controller.state.error,'');
 assert.equal(sites[0].unit,'Bureau 3');assert.equal(sites[0].version,2);
 await w.happyDOM.close();
});
test('pagination/search and stale account requests stay scoped to selected company',async()=>{
 const {w,sb,clients}=fixtures();
 for(let i=0;i<123;i++)clients.push({id:'c'+String(i).padStart(3,'0'),company_id:'tenant',name:'Client '+i,reference:'',active:true,version:1});
 clients.push({id:'outside',company_id:'other',name:'Private Other',active:true,version:1});
 const ctrl=createClientDirectoryController({sb,document:w.document,escape:esc,redraw(){},notify(){}});
 await ctrl.load('tenant');
 assert.equal(ctrl.state.clients.length,50);assert.equal(ctrl.state.clientMore,true);
 await ctrl.handle('more-clients',{dataset:{}});
 assert.equal(ctrl.state.clients.length,100);
 await ctrl.handle('more-clients',{dataset:{}});
 assert.equal(ctrl.state.clients.length,123);assert.equal(ctrl.state.clientMore,false);
 assert.equal(ctrl.state.clients.some(x=>x.company_id!=='tenant'),false);
 w.document.body.innerHTML=ctrl.render();
 w.document.getElementById('directory-client-search').value='Client 12';
 await ctrl.handle('search-clients',{dataset:{}});
 assert.ok(ctrl.state.clients.length>0&&ctrl.state.clients.every(x=>x.name.includes('Client 12')));
 await ctrl.load('other');
 assert.equal(ctrl.state.clients.length,1);assert.equal(ctrl.state.clients[0].name,'Private Other');
 await w.happyDOM.close();
});
test('planning organization integrates private directory only for managers',async()=>{
 const {w,sb,calls}=fixtures();
 const planning=createPlanningController({sb,document:w.document,escape:esc,redraw(){},notify(){}});
 await planning.load({company_id:'company-a',role:'boss'},'boss',null,[]);
 w.document.body.innerHTML=planning.renderOrganization();
 assert.match(w.document.body.textContent,/Clients et adresses d’intervention/);
 await planning.handle({dataset:{action:'ess:plan-client-new-client'}});
 w.document.body.innerHTML=planning.renderOrganization();
 assert.ok(w.document.getElementById('directory-client-name'));
 await planning.load({company_id:'company-a',role:'employee'},'employee',null,[]);
 assert.doesNotMatch(planning.renderOrganization(),/Clients et adresses d’intervention/);
 assert.ok(calls.filter(x=>x.name==='list_essential_clients').length>=1);
 await w.happyDOM.close();
});
