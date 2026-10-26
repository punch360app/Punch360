import test from 'node:test';
import assert from 'node:assert/strict';
import {createBossHandoffController} from '../web/live/boss-handoff.js';
const c='11111111-1111-4111-8111-111111111111',boss='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const escape=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function setup({role='boss',user=boss,askValue=null,status=null,mfaLevel='aal2'}={}){
 const calls=[];
 let current=status,level=mfaLevel;
 const sb={auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}}),listFactors:async()=>({data:{totp:[{id:'factor',status:'verified'}]}}),challengeAndVerify:async()=>{level='aal2';return {data:{}}},enroll:async()=>({data:{id:'factor',totp:{qr_code:'data:image/png;base64,xxx'}}})}},rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='essential_boss_handoff_status')return {data:current};
  if(name==='essential_boss_handoff_request'){current={id:'request1',version:1,from_user:boss,to_user:admin,status:'pending',can_accept:false,expires_at:'2026-10-28'};return {data:current};}
  if(name==='essential_boss_handoff_accept'){current={...current,version:2,status:'accepted',can_accept:false,can_complete:true};return {data:current};}
  if(name==='essential_boss_handoff_complete'){current=null;return {data:{status:'completed'}};}
  if(name==='essential_boss_handoff_cancel'){current=null;return {data:{status:'cancelled'}};}
  throw Error(name);
 }};
 let complete=0,ask=askValue;
 const ctrl=createBossHandoffController({sb,escape,redraw(){},getMembers:()=>[{user_id:admin,role:'admin'}],
  confirm:()=>true,prompt:()=>ask,onCompleted:()=>{complete++;}});
 return {ctrl,calls,setPrompt:x=>{ask=x;},getCompleted:()=>complete};
}
test('owner requests only a selected active admin with company+target confirmation',async()=>{
 const {ctrl,calls,setPrompt}=setup();
 await ctrl.load(c,'boss',boss);
 ctrl.input({id:'boss-handoff-successor',value:admin});ctrl.input({id:'boss-handoff-reason',value:'Relève de direction validée'});
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 assert.equal(calls.some(x=>x.name==='essential_boss_handoff_request'),false);
 assert.match(ctrl.state.error,/Confirmation/);
 setPrompt(c+':'+admin);
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 const call=calls.find(x=>x.name==='essential_boss_handoff_request');
 assert.equal(call.args.p_successor,admin);
 assert.equal(call.args.p_company,c);
 assert.equal(call.args.p_confirmation,c+':'+admin);
 assert.equal(ctrl.state.status.status,'pending');
});
test('successor accepts only after exact Boss confirmation and expected version',async()=>{
 const request={id:'req',company_id:c,version:1,from_user:boss,to_user:admin,status:'pending',can_accept:true};
 const {ctrl,calls,setPrompt}=setup({role:'admin',user:admin,status:request});
 await ctrl.load(c,'admin',admin);
 await ctrl.handle({dataset:{action:'boss-handoff:accept'}});
 assert.equal(calls.filter(x=>x.name==='essential_boss_handoff_accept').length,0);
 setPrompt(c+':'+boss);
 await ctrl.handle({dataset:{action:'boss-handoff:accept'}});
 const call=calls.find(x=>x.name==='essential_boss_handoff_accept');
 assert.equal(call.args.p_expected_version,1);
 assert.equal(call.args.p_confirmation,c+':'+boss);
});
test('only Boss completes an accepted transfer, with exact target confirmation',async()=>{
 const status={id:'req',company_id:c,version:2,from_user:boss,to_user:admin,status:'accepted',can_complete:true};
 const wrong=setup({role:'admin',user:admin,status});
 await wrong.ctrl.load(c,'admin',admin);
 await wrong.ctrl.handle({dataset:{action:'boss-handoff:complete'}});
 assert.equal(wrong.calls.some(x=>x.name==='essential_boss_handoff_complete'),false);
 const right=setup({status});await right.ctrl.load(c,'boss',boss);
 right.setPrompt(c+':'+admin);
 await right.ctrl.handle({dataset:{action:'boss-handoff:complete'}});
 assert.equal(right.getCompleted(),1);
 assert.equal(right.calls.find(x=>x.name==='essential_boss_handoff_complete')?.args.p_expected_version,2);
});
test('viewer cannot start transfer if not Boss',async()=>{
 const {ctrl,calls}=setup({role:'admin',user:admin});
 await ctrl.load(c,'admin',admin);
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 assert.equal(calls.some(x=>x.name==='essential_boss_handoff_request'),false);
});

test('unverified Boss cannot request handoff until TOTP verification',async()=>{
 const {ctrl,calls,setPrompt}=setup({mfaLevel:'aal1'});
 await ctrl.load(c,'boss',boss);
 ctrl.input({id:'boss-handoff-successor',value:admin});
 ctrl.input({id:'boss-handoff-reason',value:'Proposition volontaire de succession'});
 setPrompt(c+':'+admin);
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 assert.equal(calls.some(v=>v.name==='essential_boss_handoff_request'),false);
 await ctrl.handle({dataset:{action:'boss-handoff:mfa-enroll'}});
 assert.equal(ctrl.state.factor,'factor');
 ctrl.input({id:'boss-handoff-mfa-code',value:'111111'});
 await ctrl.handle({dataset:{action:'boss-handoff:mfa-verify'}});
 assert.equal(ctrl.state.mfaLevel,'aal2');
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 assert.equal(calls.filter(v=>v.name==='essential_boss_handoff_request').length,1);
});
test('expired handoff does not block a new Boss request',async()=>{
 const {ctrl,calls,setPrompt}=setup({status:{id:'old',status:'expired',version:1}});
 await ctrl.load(c,'boss',boss);
 ctrl.input({id:'boss-handoff-successor',value:admin});
 ctrl.input({id:'boss-handoff-reason',value:'Nouvelle demande de succession'});
 setPrompt(c+':'+admin);
 await ctrl.handle({dataset:{action:'boss-handoff:request'}});
 assert.equal(calls.filter(v=>v.name==='essential_boss_handoff_request').length,1);
});

test('AAL1 refresh does not call handoff RPC, and hides unauthenticated status refresh',async()=>{
 const {ctrl,calls}=setup({mfaLevel:'aal1'});
 await ctrl.load(c,'boss',boss);
 assert.doesNotMatch(ctrl.render(),/data-action="boss-handoff:refresh"/);
 await ctrl.handle({dataset:{action:'boss-handoff:refresh'}});
 assert.equal(calls.filter(x=>x.name==='essential_boss_handoff_status').length,0);
 assert.equal(ctrl.state.status,null);
});
test('switching companies clears MFA factor and private handoff state',async()=>{
 const current={id:'req',company_id:c,version:1,from_user:boss,to_user:admin,status:'pending',can_accept:false};
 const {ctrl}=setup({status:current});
 await ctrl.load(c,'boss',boss);
 assert.equal(ctrl.state.status.id,'req');
 ctrl.state.qr='private qr';
 ctrl.state.factor='factor';
 ctrl.state.code='123456';
 const other='44444444-4444-4444-8444-444444444444';
 await ctrl.load(other,'admin',admin);
 assert.equal(ctrl.state.company,other);
 assert.equal(ctrl.state.qr,null);
 assert.equal(ctrl.state.factor,null);
 assert.equal(ctrl.state.code,'');
});
