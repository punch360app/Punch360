import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformPriceProposalsController} from '../web/live/platform-price-proposals.js';
const company='11111111-1111-4111-8111-111111111111';
const escape=x=>String(x??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
function setup(error=null){
 const calls=[];let approved=null;let approvalVersion=0;
 const sb={rpc:async(name,args)=>{calls.push({name,args});
 if(error&&name===error.name)return {error:error.data};
 if(name==='platform_company_price_list_v2'){const count=calls.filter(v=>v.name==='platform_company_price_draft_v2').length;return {data:{company_id:company,version:count,items:count?[{id:'proposal',proposal_version:1,plan_id:'essential_pro',due_cents:2199,cadence:'monthly',status:'draft_pending_stripe'}]:[]}};}
 if(name==='platform_company_price_preview_v2')return {data:{company_id:company,plan_version:2,monthly_cents:2199,annual_cents:23749,due_cents:2199,status:'draft_pending_stripe',payment_confirmed:false}};
 if(name==='platform_company_price_draft_v2')return {data:{id:'proposal',version:1,status:'draft_pending_stripe',payment_confirmed:false}};
 if(name==='platform_company_price_approval_status')return {data:{version:approvalVersion,proposal_id:approved,provider_confirmed:false}};
 if(name==='platform_company_price_approve'){approved=args.p_proposal;approvalVersion++;return {data:{proposal_id:approved,approval_version:approvalVersion,provider_confirmed:false}};}
 throw Error(name);
 }};
 const ui=createPlatformPriceProposalsController({sb,redraw(){},escape});
 ui.input({id:'platform-price-company',value:company});
 ui.input({id:'platform-price-reason',value:'Tarif commercial spécial audité'});
 ui.input({id:'platform-price-plan',value:'essential_pro'});
 ui.input({id:'platform-price-seats',value:'7'});
 ui.input({id:'platform-price-base',value:'1799'});
 ui.input({id:'platform-price-extra',value:'200'});
 ui.input({id:'platform-price-discount',value:'10'});
 return {ui,calls};
}
test('MFA RPC flow loads version then previews without activating Stripe',async()=>{
 const {ui,calls}=setup();
 await ui.handle({dataset:{action:'platform-price:load'}});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 assert.deepEqual(calls.map(c=>c.name),['platform_company_price_list_v2','platform_company_price_approval_status','platform_company_price_preview_v2']);
 assert.equal(calls.at(-1).args.p_company,company);
 assert.equal(calls.at(-1).args.p_plan,'essential_pro');
 assert.equal(calls.at(-1).args.p_seats,7);
 assert.match(ui.render(),/2\s?199|21,99|21.99/); // amount depends on Intl runtime
 assert.match(ui.render(),/Aucun paiement ou contrat modifié/);
});
test('draft requires exact company confirmation; saved version stays provider-pending',async()=>{
 const {ui,calls}=setup();
 await ui.handle({dataset:{action:'platform-price:load'}});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 await ui.handle({dataset:{action:'platform-price:draft'}});
 assert.equal(calls.filter(x=>x.name==='platform_company_price_draft_v2').length,0);
 assert.match(ui.state.error,/Confirmation/);
 ui.input({id:'platform-price-confirmation',value:company});
 // Repreview required after any change including confirmation.
 await ui.handle({dataset:{action:'platform-price:preview'}});
 await ui.handle({dataset:{action:'platform-price:draft'}});
 const m=calls.find(x=>x.name==='platform_company_price_draft_v2');
 assert.equal(m.args.p_expected_version,0);
 assert.equal(m.args.p_expected_plan_version,2);
 assert.equal(m.args.p_confirmation,company);
 assert.match(ui.state.notice,/Aucune activation Stripe/);
 assert.equal(ui.state.preview,null);
});
test('bad UUID or missing reason blocks reads; expired MFA clears proposal data',async()=>{
 const {ui,calls}=setup();
 ui.input({id:'platform-price-company',value:'wrong'});
 await ui.handle({dataset:{action:'platform-price:load'}});
 assert.equal(calls.length,0);
 assert.match(ui.state.error,/UUID/);
 const v=setup({name:'platform_company_price_preview_v2',data:{code:'42501',message:'MFA expirée'}}),other=v.ui;
 await other.handle({dataset:{action:'platform-price:load'}});
 await other.handle({dataset:{action:'platform-price:preview'}});
 assert.equal(other.state.list,null);
 assert.equal(other.state.preview,null);
});
test('changing draft values clears preview so stale server quote is never submitted',async()=>{
 const {ui,calls}=setup();
 await ui.handle({dataset:{action:'platform-price:load'}});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 ui.input({id:'platform-price-base',value:'4000'});
 ui.input({id:'platform-price-confirmation',value:company});
 await ui.handle({dataset:{action:'platform-price:draft'}});
 assert.equal(calls.filter(v=>v.name==='platform_company_price_draft_v2').length,0);
 assert.match(ui.state.error,/Prévisualiser/);
});

test('owner approves only the selected latest proposal with exact company ID and no Stripe charge',async()=>{
 const {ui,calls}=setup();
 await ui.handle({dataset:{action:'platform-price:load'}});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 ui.input({id:'platform-price-confirmation',value:company});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 await ui.handle({dataset:{action:'platform-price:draft'}});
 assert.match(ui.render(),/Approuver cette proposition pour le Boss/);
 await ui.handle({dataset:{action:'platform-price:approve',id:'proposal'}});
 assert.equal(calls.filter(v=>v.name==='platform_company_price_approve').length,0);
 assert.match(ui.state.error,/Recopier/);
 ui.input({id:'platform-price-approveConfirmation',value:company});
 await ui.handle({dataset:{action:'platform-price:approve',id:'old'}});
 assert.equal(calls.filter(v=>v.name==='platform_company_price_approve').length,0);
 await ui.handle({dataset:{action:'platform-price:approve',id:'proposal'}});
 const call=calls.find(v=>v.name==='platform_company_price_approve');
 assert.equal(call.args.p_confirmation,company);
 assert.equal(call.args.p_expected_approval_version,0);
 assert.equal(call.args.p_proposal,'proposal');
 assert.equal(ui.state.approval.version,1);
 assert.match(ui.state.notice,/Aucun prix activé ni paiement/);
});

test('SACATALOG-016 unlimited negotiated price preserves numeric base and requires new preview',async()=>{
 const {ui,calls}=setup();
 await ui.handle({dataset:{action:'platform-price:load'}});
 ui.input({id:'platform-price-includedUnlimited',checked:true});
 assert.equal(ui.state.includedUnlimited,true);
 assert.match(ui.render(),/Membres inclus illimités/);
 await ui.handle({dataset:{action:'platform-price:preview'}});
 const a=calls.find(c=>c.name==='platform_company_price_preview_v2');
 assert.equal(a.args.p_included_unlimited,true);
 assert.equal(a.args.p_included,50);
 ui.input({id:'platform-price-confirmation',value:company});
 await ui.handle({dataset:{action:'platform-price:preview'}});
 await ui.handle({dataset:{action:'platform-price:draft'}});
 const b=calls.find(c=>c.name==='platform_company_price_draft_v2');
 assert.equal(b.args.p_included_unlimited,true);
 ui.input({id:'platform-price-includedUnlimited',checked:false});
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.includedUnlimited,false);
});
