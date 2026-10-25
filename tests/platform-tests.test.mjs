import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPlatformTestHandler} from '../supabase/functions/platform-test-users/handler.js';
import {createPlatformTestsController} from '../web/live/platform-tests.js';
const uid='11111111-1111-4111-8111-111111111111';
const env=n=>({SUPABASE_URL:'https://mlabstdxxwjdpfaxiwmg.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'}[n]);
const req=body=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer session'},body:JSON.stringify(body)});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('test account endpoint refuses missing auth and missing live MFA before privileged calls',async()=>{
 let calls=0;const handler=createPlatformTestHandler({env,fetch:async url=>{calls++;return url.endsWith('/user')?json({id:uid}):json({message:'MFA required'},403)}});
 assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);assert.equal(calls,0);
 assert.equal((await handler(req({action:'delete',user_id:uid}))).status,403);assert.equal(calls,2);
});
test('soft deletion uses checked target, preserves history and resumes after provider success',async()=>{
 const calls=[];const handler=createPlatformTestHandler({env,fetch:async(url,init)=>{calls.push({url,...init});if(url.endsWith('/user'))return json({id:uid});if(url.endsWith('/platform_begin_test_action'))return json('operation');if(url.endsWith('/platform_test_action_payload'))return json({kind:'delete',user_id:uid});if(url.endsWith('/admin/users/'+uid))return json({id:uid,deleted_at:'2026-10-25'});return json(true)}});
 const response=await handler(req({action:'delete',user_id:uid,reason:'Recette',confirmation:'test@example.test'}));assert.equal(response.status,200);assert.equal((await response.json()).history_preserved,true);assert.equal(calls.some(c=>c.method==='DELETE'),false);assert.ok(calls.some(c=>c.url.endsWith('/platform_complete_test_action')));
});
test('provider deletion failure leaves operation pending for retry',async()=>{
 const calls=[];const handler=createPlatformTestHandler({env,fetch:async(url,init)=>{calls.push({url,...init});if(url.endsWith('/user'))return json({id:uid});if(url.endsWith('/platform_begin_test_action'))return json('operation');if(url.endsWith('/platform_test_action_payload'))return json({kind:'delete',user_id:uid});if(init.method==='DELETE')return json({},500);if(url.endsWith('/admin/users/'+uid))return json({id:uid});return json(true)}});
 assert.equal((await handler(req({action:'delete',user_id:uid,reason:'Recette'}))).status,502);assert.equal(calls.some(c=>c.url.endsWith('/platform_complete_test_action')),false);assert.equal(JSON.parse(calls.find(c=>c.method==='DELETE').body).should_soft_delete,true);
});
function uiFixture(invoke){const w=new Window(),s={plans:[],snapshot:{companies_list:[]},testAccounts:[{user_id:uid,email:'test@example.test'}]};const ui=createPlatformTestsController({sb:{rpc:async()=>({data:s.testAccounts}),functions:{invoke}},state:s,redraw(){},escape:s=>String(s??'').replaceAll('"','&quot;'),document:w.document,schedule:()=>1,cancel(){}});ui.input({id:'ess-test-reason',value:'Recette du rôle'});return {w,s,ui}}
test('credential arriving after logout cannot reappear',async()=>{let release;const {w,s,ui}=uiFixture(()=>new Promise(r=>{release=r}));const pending=ui.handle({dataset:{action:'ess:test-password',id:uid}});ui.reset();release({data:{password:'secret'}});await pending;assert.equal(s.testCredentials,null);await w.happyDOM.close()});
test('credential is erased on window blur and hidden responses stay erased',async()=>{const {w,s,ui}=uiFixture(async()=>({data:{password:'secret'}}));await ui.handle({dataset:{action:'ess:test-password',id:uid}});assert.equal(s.testCredentials.password,'secret');w.dispatchEvent(new w.Event('blur'));assert.equal(s.testCredentials,null);await w.happyDOM.close()});
