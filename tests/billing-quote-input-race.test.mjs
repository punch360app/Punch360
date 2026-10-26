import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {createBillingController} from '../web/live/billing.js';

const COMPANY='11111111-1111-4111-8111-111111111111';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const setup=({rpc,invoke,open=()=>{}}={})=>{
 const window=new Window(),calls=[];
 const sb={
  rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});return rpc?.(name,args)??{data:'order-123'}},
  functions:{invoke:async(name,args)=>{calls.push({kind:'edge',name,action:args.body.action,args:args.body});return invoke?.(name,args)??{data:{preview:{amount_due:2000,total:2000}}}}}
 };
 const ui=createBillingController({sb,document:window.document,redraw(){},escape:s=>String(s),open});
 Object.assign(ui.state,{company:COMPANY,configured:true,summary:{has_subscription:true,status:'active',seats:20,active_humans:5,test_company:false},plans:[{id:'essential',title:'Essentiel'},{id:'essential_pro',title:'Pro'}]});
 window.document.body.innerHTML=ui.render();
 return {ui,window,calls,close:()=>window.happyDOM.close()};
};
test('a Boss editing seats invalidates a displayed Stripe confirmation immediately',async()=>{
 const {ui,window,close}=setup();
 ui.state.order='saved-order';
 ui.state.preview={description:'Devis Pro pour 50 places'};
 window.document.body.innerHTML=ui.render();
 assert.ok(window.document.querySelector('[data-action="bill:confirm"]'));
 assert.equal(ui.input({id:'billing-seats',value:'51'}),true);
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.order,null);
 assert.equal(window.document.querySelector('[data-action="bill:confirm"]').disabled,true);
 assert.equal(ui.input({id:'unrelated',value:'x'}),false);
 await close();
});
test('a late order RPC cannot preview or resurrect a quote after changing the plan',async()=>{
 const deferredOrder=deferred(),{ui,calls,close}=setup({rpc:name=>name==='essential_billing_order'?deferredOrder.promise:{data:'other'}});
 const inFlight=ui.handle({dataset:{action:'bill:quote'}});
 assert.equal(calls.at(0).name,'essential_billing_order');
 ui.input({id:'billing-plan',value:'essential_pro'});
 deferredOrder.resolve({data:'old-order'});
 await inFlight;
 assert.equal(calls.filter(c=>c.kind==='edge').length,0,'no second Stripe call from an obsolete quote');
 assert.equal(ui.state.order,null);
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.busy,false);
 assert.equal(ui.state.error,'');
 await close();
});
test('a late Stripe preview cannot restore a quote after changing the cadence',async()=>{
 const pending=deferred(),{ui,calls,close}=setup({
  rpc:async()=>({data:'order-monthly'}),
  invoke:async()=>pending.promise
 });
 const inFlight=ui.handle({dataset:{action:'bill:quote'}});
 for(let i=0;i<8&&!calls.some(c=>c.action==='preview');i++)await Promise.resolve();
 assert.equal(calls.some(c=>c.action==='preview'),true);
 ui.input({id:'billing-cadence',value:'yearly'});
 pending.resolve({data:{preview:{amount_due:7700,total:7700}}});
 await inFlight;
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.order,null);
 assert.equal(ui.state.error,'');
 await close();
});
test('a stale confirm response cannot redirect to checkout after a form edit',async()=>{
 const pending=deferred(),opened=[],{ui,calls,close}=setup({
  invoke:async()=>pending.promise,open:url=>opened.push(url)
 });
 ui.state.preview={description:'Old quote'};
 ui.state.order='old-order';
 const task=ui.handle({dataset:{action:'bill:confirm'}});
 assert.equal(calls.at(-1).action,'confirm');
 ui.input({id:'billing-seats',value:'21'});
 pending.resolve({data:{url:'https://checkout.stripe.com/old-quote'}});
 await task;
 assert.deepEqual(opened,[]);
 assert.equal(ui.state.order,null);
 assert.equal(ui.state.preview,null);
 await close();
});
test('delegated DOM change and input handlers are wired into Boss billing controller',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const essential=readFileSync(new URL('../web/live/essential.js',import.meta.url),'utf8');
 assert.match(essential,/function input\(el\)\{billing\.input\(el\);subscriptions\.input/);
 assert.match(app,/document\.addEventListener\('change',[\s\S]{0,290}essentialUI\.billing\.input\(ev\.target\)/);
 assert.match(app,/document\.addEventListener\('input',[\s\S]{0,100}essentialUI\.input\(ev\.target\)/);
});
