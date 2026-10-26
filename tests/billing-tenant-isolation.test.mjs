import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createBillingController} from '../web/live/billing.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const escape=value=>String(value??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function configure(ui,company=A){
 ui.state.company=company;
 ui.state.summary={status:'active',active_humans:3,seats:5,has_subscription:true,test_company:false};
 ui.state.configured=true;
 ui.state.plans=[{id:'essential_plus',title:'Essentiel Plus'}];
 ui.state.offer={approval_version:2,plan_id:'essential_plus',title:'Plus',seats:5,due_cents:3900,cadence:'monthly',effective_on:'2026-10-26',available:true};
}

test('a Boss offer order returned after switching company cannot preview or alter the next company',async()=>{
 const w=new Window(),pending=deferred(),calls=[];
 const sb={
  rpc:async(name,args)=>{calls.push({name,args});return pending.promise;},
  functions:{invoke:async(_name,options)=>{calls.push({action:options.body.action});return {data:{preview:{amount_due:100}}};}}
 };
 const ui=createBillingController({sb,redraw(){},escape,document:w.document});
 configure(ui);
 const inFlight=ui.handle({dataset:{action:'bill:offer'}});
 assert.equal(calls[0].name,'essential_company_price_order');
 assert.equal(calls[0].args.p_company,A);
 ui.reset();
 configure(ui,B);
 pending.resolve({data:'old-company-order'});
 await inFlight;
 assert.equal(ui.state.company,B);
 assert.equal(ui.state.order,null);
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.error,'');
 assert.equal(ui.state.busy,false);
 assert.equal(calls.length,1,'no Stripe preview for a stale company');
 await w.happyDOM.close();
});

test('late Stripe preview cannot repopulate another Boss billing screen or clear its busy state',async()=>{
 const w=new Window(),pending=deferred(),calls=[];
 const sb={
  rpc:async(name,args)=>{calls.push({name,args});return {data:'old-company-order'};},
  functions:{invoke:async(_name,options)=>{calls.push({action:options.body.action,company:options.body.companyId});return pending.promise;}}
 };
 const ui=createBillingController({sb,redraw(){},escape,document:w.document});
 configure(ui);
 w.document.body.innerHTML=ui.render();
 const inFlight=ui.handle({dataset:{action:'bill:quote'}});
 for(let tick=0;tick<12&&!calls.some(x=>x.action==='preview');tick++)await Promise.resolve();
 assert.ok(calls.some(x=>x.action==='preview'&&x.company===A));
 ui.reset();
 configure(ui,B);
 ui.state.busy=true; // A separate action is now in progress for B.
 pending.resolve({data:{preview:{amount_due:99999,total:99999}}});
 await inFlight;
 assert.equal(ui.state.company,B);
 assert.equal(ui.state.preview,null);
 assert.equal(ui.state.order,null);
 assert.equal(ui.state.busy,true,'old action must not unlock the new action');
 await w.happyDOM.close();
});

test('old Stripe portal URL cannot redirect after a Boss signs out',async()=>{
 const w=new Window(),pending=deferred(),opened=[];
 const sb={rpc:async()=>({data:null}),functions:{invoke:async()=>pending.promise}};
 const ui=createBillingController({sb,redraw(){},escape,document:w.document,open:url=>opened.push(url)});
 configure(ui);
 const inFlight=ui.handle({dataset:{action:'bill:portal'}});
 ui.reset();
 pending.resolve({data:{url:'https://billing.stripe.com/old-company'}});
 await inFlight;
 assert.deepEqual(opened,[]);
 assert.equal(ui.state.company,null);
 assert.equal(ui.state.busy,false);
 await w.happyDOM.close();
});
