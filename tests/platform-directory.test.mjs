import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformDirectoryController} from '../web/live/platform-directory.js';
function setup(){const calls=[],opened=[];let failed=false;const sb={rpc:async(name,args)=>{calls.push({name,args});return failed?{error:{message:'offline'}}:{data:{items:[{id:'company',name:'<Fixture>',product_edition:'essential',billing_status:'active',seat_limit:5}],has_more:!args.p_before,before:'2026-10-25T00:00:00Z',before_id:'cursor'}}}};return {calls,opened,setFailed:v=>{failed=v},ui:createPlatformDirectoryController({sb,redraw(){},escape:v=>String(v??'').replaceAll('<','&lt;'),onArchives:c=>opened.push(c)})}}
test('company directory pages keep applied filters and failed pages do not corrupt history',async()=>{const {ui,calls,setFailed}=setup();ui.input({id:'directory-query',value:'Original'});await ui.handle({dataset:{action:'directory:search'}});ui.input({id:'directory-query',value:'Unsubmitted'});setFailed(true);await ui.handle({dataset:{action:'directory:next'}});assert.equal(ui.state.pages.length,0);setFailed(false);await ui.handle({dataset:{action:'directory:next'}});assert.equal(calls.at(-1).args.p_query,'Original');assert.equal(ui.state.pages.length,1);await ui.handle({dataset:{action:'directory:previous'}});assert.equal(calls.at(-1).args.p_before,null);assert.equal(calls.at(-1).args.p_query,'Original');assert.equal(ui.state.pages.length,0)});
test('company directory escapes names and opens the selected archive without exporting',async()=>{const {ui,opened}=setup();await ui.load();assert.match(ui.render(),/&lt;Fixture>/);await ui.handle({dataset:{action:'directory:archives',id:'company'}});assert.equal(opened[0].id,'company');ui.reset();assert.deepEqual(ui.state.items,[])});
test('company details require a consultation purpose and do not issue mutations',async()=>{const calls=[],ui=createPlatformDirectoryController({redraw(){},escape:String,sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'company',name:'Fixture',seat_limit:5,active_members:2,disabled_members:0,active_workers:3,workers_without_account:1,entitlement:{features:[]}}}}}});await ui.handle({dataset:{action:'directory:detail',id:'company'}});assert.equal(calls.length,0);ui.input({id:'directory-reason',value:'Support consultation'});await ui.handle({dataset:{action:'directory:detail',id:'company'}});assert.equal(calls[0].name,'platform_company_detail');assert.match(ui.render(),/2 membres avec compte actifs/);assert.match(ui.render(),/Aucun abonnement confirmé/);ui.reset();assert.equal(ui.state.detail,null)});

test('price draft entry is limited to real Essentiel companies and opens only its chosen ID',async()=>{
 const chosen=[],companies=[
 {id:'real',name:'Commerce',product_edition:'essential',is_test:false,billing_status:'active',seat_limit:5},
 {id:'test',name:'Test',product_edition:'essential',is_test:true,billing_status:'active',seat_limit:5},
 {id:'construction',name:'Chantier',product_edition:'construction',is_test:false,billing_status:'active',seat_limit:5}
 ];
 const ui=createPlatformDirectoryController({sb:{rpc:async()=>({data:{items:companies,has_more:false}})},redraw(){},escape:String,onPriceCompany:company=>chosen.push(company)});
 await ui.handle({dataset:{action:'directory:search'}});
 assert.equal((ui.render().match(/data-action="directory:price"/g)||[]).length,1);
 await ui.handle({dataset:{action:'directory:price',id:'test'}});
 await ui.handle({dataset:{action:'directory:price',id:'construction'}});
 assert.equal(chosen.length,0);
 await ui.handle({dataset:{action:'directory:price',id:'real'}});
 assert.deepEqual(chosen.map(c=>c.id),['real']);
});

test('revoked Super Admin access clears company list, profile, cursor and private service controls',async()=>{
 let deny=false;const opened=[],calls=[];
 const company={id:'tenant-test-1',name:'Entreprise interne fictive',product_edition:'essential',
  billing_status:'active',seat_limit:5,is_test:false};
 const sb={rpc:async(name,args)=>{
  calls.push(name);
  if(deny)return {error:{code:'42501',message:'SQL SECRET: owner support email'}};
  if(name==='platform_search_companies')return {data:{items:[company],has_more:true,
   before:'2026-10-28T12:00:00Z',before_id:'cursor'}};
  if(name==='platform_company_detail')return {data:{...company,entitlement:{features:[]},
   service_controls:{version:2,suspended:false,grace_days:null}}};
  throw Error('Unexpected RPC');
 }};
 const ui=createPlatformDirectoryController({sb,redraw(){},
  escape:x=>String(x??'').replaceAll('<','&lt;'),onArchives:c=>opened.push(c),
  onPriceCompany:c=>opened.push(c)});
 await ui.load();
 ui.input({id:'directory-reason',value:'Consultation de support'});
 await ui.handle({dataset:{action:'directory:detail',id:company.id}});
 assert.match(ui.render(),/Entreprise interne fictive/);
 assert.ok(ui.state.detail?.service_controls);
 deny=true;
 await ui.handle({dataset:{action:'directory:next'}});
 assert.deepEqual(ui.state.items,[]);
 assert.equal(ui.state.detail,null);
 assert.deepEqual(ui.state.pages,[]);
 assert.equal(ui.state.cursor,null);
 assert.equal(ui.state.next,null);
 assert.deepEqual(ui.state.applied,{});
 assert.equal(ui.state.reason,'');
 assert.equal(ui.state.serviceConfirmation,'');
 assert.match(ui.render(),/Reconnectez-vous avec MFA/);
 assert.doesNotMatch(ui.render(),/Entreprise interne fictive|SQL SECRET/);
 await ui.handle({dataset:{action:'directory:archives',id:company.id}});
 await ui.handle({dataset:{action:'directory:price',id:company.id}});
 assert.deepEqual(opened,[]);
});

test('denied detail and service responses never retain prior real-company data',async()=>{
 let denial=null,op='';
 const company={id:'tenant-a',name:'Client test',product_edition:'essential',
  billing_status:'active',seat_limit:3,is_test:false,
  service_controls:{version:4,suspended:false,grace_days:30},entitlement:{features:[]}};
 const sb={rpc:async(name)=>{
  op=name;
  if(denial===name)return {error:{status:403,message:'provider diagnostic private'}};
  return name==='platform_search_companies'?{data:{items:[company],has_more:false}}:
   name==='platform_company_detail'?{data:company}:
   {data:{version:5,suspended:true,effective_status:'restricted',grace_days:null}};
 }};
 const ui=createPlatformDirectoryController({sb,redraw(){},escape:String});
 await ui.load();
 ui.input({id:'directory-reason',value:'Contrôle autorisé'});
 denial='platform_company_detail';
 await ui.handle({dataset:{action:'directory:detail',id:'tenant-a'}});
 assert.deepEqual(ui.state.items,[]);
 assert.equal(ui.state.detail,null);
 assert.doesNotMatch(ui.render(),/Client test|provider diagnostic private/);
 denial=null;
 await ui.load();
 ui.input({id:'directory-reason',value:'Contrôle autorisé'});
 await ui.handle({dataset:{action:'directory:detail',id:'tenant-a'}});
 ui.input({id:'directory-service-confirmation',value:'tenant-a'});
 ui.input({id:'directory-service-reason',value:'Test motif valide'});
 denial='platform_set_company_service';
 await ui.handle({dataset:{action:'directory:service'}});
 assert.equal(op,'platform_set_company_service');
 assert.equal(ui.state.detail,null);
 assert.deepEqual(ui.state.items,[]);
 assert.match(ui.state.error,/Reconnectez-vous avec MFA/);
});

test('directory shows actionable loading state without two simultaneous searches',async()=>{
 let finish;let calls=0;
 const sb={rpc:async()=>{
  calls++;
  await new Promise(resolve=>{finish=resolve});
  return {data:{items:[],has_more:false}};
 }};
 const ui=createPlatformDirectoryController({sb,redraw(){},escape:String});
 const pending=ui.handle({dataset:{action:'directory:search'}});
 assert.equal(ui.state.busy,true);
 assert.match(ui.render(),/role="status"/);
 assert.match(ui.render(),/Vérification en cours/);
 assert.match(ui.render(),/data-action="directory:search" disabled/);
 await ui.handle({dataset:{action:'directory:search'}});
 assert.equal(calls,1);
 finish();await pending;
 assert.equal(ui.state.busy,false);
 assert.doesNotMatch(ui.render(),/Vérification en cours/);
});

test('unexpected response or provider error is safely presented without data or diagnostics',async()=>{
 const cases=[{data:{unexpected:'shape'}},{error:{message:'internal secret query params'}}];
 for(const result of cases){
  const ui=createPlatformDirectoryController({sb:{rpc:async()=>result},redraw(){},escape:String});
  await ui.load();
  assert.deepEqual(ui.state.items,[]);
  assert.match(ui.render(),/Impossible de consulter ou modifier/);
  assert.doesNotMatch(ui.render(),/internal secret|unexpected/);
 }
});
