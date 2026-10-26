import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformPriceProposalsController} from '../web/live/platform-price-proposals.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const e=s=>String(s??'').replaceAll('<','&lt;');
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function create(rpc){
 const calls=[];let draws=0;
 const sb={rpc:(name,args)=>{calls.push({name,args});return rpc(name,args)}};
 const ui=createPlatformPriceProposalsController({sb,redraw(){draws++},escape:e});
 ui.choose(A);
 ui.input({id:'platform-price-reason',value:'Audit du contrat spécial'});
 return {ui,calls,get draws(){return draws}};
}
const list=company=>({data:{company_id:company,version:1,items:[{id:'proposal-A',proposal_version:1,plan_id:'essential',due_cents:1900,cadence:'monthly'}]}});
const approval={data:{version:0,proposal_id:null}};
const preview={data:{plan_version:1,due_cents:1900,monthly_cents:1900,annual_cents:19380}};

test('late proposal list cannot repopulate after logout or trigger approval read',async()=>{
 const pending=defer();
 const h=create(name=>name==='platform_company_price_list'?pending.promise:approval);
 const load=h.ui.handle({dataset:{action:'platform-price:load'}});
 h.ui.reset();
 pending.resolve(list(A));
 await load;
 assert.equal(h.ui.state.company,'');
 assert.equal(h.ui.state.list,null);
 assert.equal(h.ui.state.approval,null);
 assert.deepEqual(h.calls.map(c=>c.name),['platform_company_price_list']);
});

test('late approval result cannot overwrite newly selected company',async()=>{
 const pending=defer();
 const h=create((name,args)=>name==='platform_company_price_list'?list(args.p_company):pending.promise);
 const load=h.ui.handle({dataset:{action:'platform-price:load'}});
 // Allow first awaited list read to settle and approval RPC to start.
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls.at(-1).name,'platform_company_price_approval_status');
 h.ui.choose(B);
 pending.resolve(approval);
 await load;
 assert.equal(h.ui.state.company,B);
 assert.equal(h.ui.state.list,null);
 assert.equal(h.ui.state.approval,null);
});

test('late preview response does not resurrect proposal after reset',async()=>{
 const pending=defer();
 const h=create(name=>name==='platform_company_price_list'?list(A):name==='platform_company_price_approval_status'?approval:pending.promise);
 await h.ui.handle({dataset:{action:'platform-price:load'}});
 const task=h.ui.handle({dataset:{action:'platform-price:preview'}});
 h.ui.reset();pending.resolve(preview);
 await task;
 assert.equal(h.ui.state.preview,null);
 assert.equal(h.ui.state.company,'');
});

test('late completed draft never loads another company or displays old approval notice',async()=>{
 const pending=defer();
 const h=create(name=>name==='platform_company_price_list'?list(A):name==='platform_company_price_approval_status'?approval:name==='platform_company_price_preview'?preview:pending.promise);
 await h.ui.handle({dataset:{action:'platform-price:load'}});
 await h.ui.handle({dataset:{action:'platform-price:preview'}});
 h.ui.input({id:'platform-price-confirmation',value:A});
 await h.ui.handle({dataset:{action:'platform-price:preview'}});
 const task=h.ui.handle({dataset:{action:'platform-price:draft'}});
 h.ui.choose(B);
 pending.resolve({data:{version:2}});
 await task;
 assert.equal(h.ui.state.company,B);
 assert.equal(h.ui.state.list,null);
 assert.equal(h.ui.state.notice,'');
 assert.equal(h.calls.filter(c=>c.name==='platform_company_price_list').length,1);
});

test('late approval completion does not trigger follow-up status read after signout',async()=>{
 const pending=defer();
 const h=create(name=>name==='platform_company_price_list'?list(A):name==='platform_company_price_approval_status'?approval:pending.promise);
 await h.ui.handle({dataset:{action:'platform-price:load'}});
 h.ui.input({id:'platform-price-approveConfirmation',value:A});
 const task=h.ui.handle({dataset:{action:'platform-price:approve',id:'proposal-A'}});
 h.ui.reset();pending.resolve({data:{proposal_id:'proposal-A'}});
 await task;
 assert.equal(h.ui.state.approval,null);
 assert.equal(h.ui.state.notice,'');
 assert.equal(h.calls.filter(c=>c.name==='platform_company_price_approval_status').length,1);
});

test('sensitive database errors are never shown in the Super Admin interface',async()=>{
 const h=create(()=>({error:{code:'42501',message:'private SQL data: vault_secret_never_display'}}));
 await h.ui.handle({dataset:{action:'platform-price:load'}});
 assert.match(h.ui.state.error,/session MFA/);
 assert.doesNotMatch(h.ui.state.error,/vault_secret|private SQL/);
 assert.equal(h.ui.state.list,null);
 assert.equal(h.ui.state.approval,null);
});

test('changes to company and reason discard loaded approvals and confirmation',async()=>{
 const h=create(name=>name==='platform_company_price_list'?list(A):approval);
 await h.ui.handle({dataset:{action:'platform-price:load'}});
 h.ui.input({id:'platform-price-approveConfirmation',value:A});
 h.ui.input({id:'platform-price-reason',value:'Autre motif détaillé'});
 assert.equal(h.ui.state.approval,null);
 assert.equal(h.ui.state.list,null);
 assert.equal(h.ui.state.approveConfirmation,'');
});
