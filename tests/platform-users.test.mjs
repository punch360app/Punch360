import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformUsersController} from '../web/live/platform-users.js';
test('platform users require a purpose, preserve applied filters and clear PII on revoked access',async()=>{const calls=[];let denied=false;const ui=createPlatformUsersController({redraw(){},escape:v=>String(v??'').replaceAll('<','&lt;'),sb:{rpc:async(name,args)=>{calls.push({name,args});return denied?{error:{code:'42501',message:'Session MFA expirée'}}:{data:{items:[{id:'user',email:'<private>@example.invalid',active_memberships:1}],has_more:true,before:'2026-10-25T00:00:00Z',before_id:'cursor'}}}}});await ui.handle({dataset:{action:'platform-user:search'}});assert.equal(calls.length,0);ui.input({id:'platform-user-reason',value:'Support test'});ui.input({id:'platform-user-query',value:'Original'});await ui.handle({dataset:{action:'platform-user:search'}});assert.match(ui.render(),/&lt;private>/);ui.input({id:'platform-user-query',value:'Unsubmitted'});await ui.handle({dataset:{action:'platform-user:next'}});assert.equal(calls.at(-1).args.p_query,'Original');denied=true;await ui.handle({dataset:{action:'platform-user:search'}});assert.deepEqual(ui.state.items,[]);ui.reset();assert.equal(ui.state.reason,'')});

const person='11111111-1111-4111-8111-111111111111',company='22222222-2222-4222-8222-222222222222';
function setupReal({ask=()=>person+':'+company,confirm=()=>true,previewError=null}={}){
 const calls=[],user={id:person,email:'employee@example.invalid',is_test:false,is_platform_owner:false,active_memberships:2};
 let version=0,stopped=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='platform_search_users')return {data:{items:[user,{...user,id:'33333333-3333-4333-8333-333333333333',is_platform_owner:true},{...user,id:'44444444-4444-4444-8444-444444444444',is_test:true}],has_more:false}};
  if(name==='platform_member_access_preview')return previewError?{error:previewError}:{data:{company_id:company,user_id:person,role:'employee',member_status:stopped?'disabled':'active',worker_count:1,worker_status:stopped?'disabled':'active',version,suspended:stopped,active_punch:false,can_suspend:!stopped,can_restore:stopped}};
  if(name==='platform_member_access_change'){stopped=args.p_action==='suspend';version++;return {data:{version,suspended:stopped}};}
  throw Error('Unexpected RPC '+name);
 }};
 const ui=createPlatformUsersController({sb,escape:x=>String(x??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),redraw(){},prompt:ask,confirm});
 ui.input({id:'platform-user-reason',value:'Vérification de compte utilisateur'});
 ui.input({id:'platform-user-company',value:company});
 return {ui,calls};
}
test('real Super Admin actions require scoped company search, preview, MFA RPC and precise version',async()=>{
 const {ui,calls}=setupReal();
 await ui.handle({dataset:{action:'platform-user:search'}});
 const markup=ui.render();
 assert.match(markup,/Gérer dans cette compagnie/);
 assert.equal((markup.match(/platform-user:inspect/g)||[]).length,1,'Only the real, non-owner account has an intervention');
 await ui.handle({dataset:{action:'platform-user:inspect',id:person}});
 assert.equal(calls.at(-1).name,'platform_member_access_preview');
 assert.match(ui.render(),/Suspendre cet accès/);
 await ui.handle({dataset:{action:'platform-user:suspend'}});
 const action=calls.find(c=>c.name==='platform_member_access_change');
 assert.deepEqual(action.args,{p_company:company,p_user:person,p_action:'suspend',p_expected_version:0,p_confirmation:person+':'+company,p_reason:'Vérification de compte utilisateur'});
 assert.equal(ui.state.preview.suspended,true);
 assert.match(ui.render(),/Rétablir cet accès/);
 await ui.handle({dataset:{action:'platform-user:restore'}});
 assert.equal(calls.filter(x=>x.name==='platform_member_access_change').length,2);
 assert.equal(ui.state.preview.suspended,false);
});
test('no mutation on refused confirmation, even after valid preview',async()=>{
 const {ui,calls}=setupReal({ask:()=>person+':WRONG'});
 await ui.handle({dataset:{action:'platform-user:search'}});
 await ui.handle({dataset:{action:'platform-user:inspect',id:person}});
 await ui.handle({dataset:{action:'platform-user:suspend'}});
 assert.equal(calls.filter(x=>x.name==='platform_member_access_change').length,0);
 assert.match(ui.state.error,/confirmation/);
});
test('cannot intervene using stale/changed company filters or test/owner users',async()=>{
 const {ui,calls}=setupReal();
 await ui.handle({dataset:{action:'platform-user:search'}});
 await ui.handle({dataset:{action:'platform-user:inspect',id:'33333333-3333-4333-8333-333333333333'}});
 assert.equal(calls.filter(x=>x.name==='platform_member_access_preview').length,0);
 ui.input({id:'platform-user-company',value:'55555555-5555-4555-8555-555555555555'});
 await ui.handle({dataset:{action:'platform-user:inspect',id:person}});
 assert.equal(calls.filter(x=>x.name==='platform_member_access_preview').length,0);
 assert.match(ui.state.error,/Filtrer par une entreprise/);
});
test('an MFA denial on per-company preview clears personal data and intervention',async()=>{
 const {ui}=setupReal({previewError:{code:'42501',message:'Session MFA expirée'}});
 await ui.handle({dataset:{action:'platform-user:search'}});
 assert.ok(ui.state.items.length);
 await ui.handle({dataset:{action:'platform-user:inspect',id:person}});
 assert.deepEqual(ui.state.items,[]);
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.selected,null);
});
