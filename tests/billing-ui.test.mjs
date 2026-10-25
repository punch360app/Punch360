import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {createBillingController} from '../web/live/billing.js';
const escape=s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
test('billing change requires server quote before confirmation and never grants access locally',async()=>{const w=new Window(),calls=[];const sb={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='essential_billing_order'?'order-1':{due_cents:19380}}},functions:{invoke:async(name,args)=>{calls.push({name,...args.body});return {data:args.body.action==='preview'?{preview:{amount_due:400,total:400,effective_at:123}}:{pending_server_confirmation:true}}}}};const ui=createBillingController({sb,redraw(){},escape,document:w.document});ui.state.company='tenant';ui.state.configured=true;ui.state.summary={active_humans:5,seats:5,has_subscription:true};ui.state.plans=[{id:'essential',title:'Essentiel'}];w.document.body.innerHTML=ui.render();await ui.handle({dataset:{action:'bill:confirm'}});assert.match(ui.state.error,/Prévisualisation/);assert.equal(calls.length,0);await ui.handle({dataset:{action:'bill:quote'}});assert.equal(calls[0].name,'essential_billing_order');assert.equal(calls[1].action,'preview');assert.equal(ui.state.order,'order-1');assert.equal(ui.state.preview.amount_due,400);assert.equal(ui.state.summary.status,undefined);await w.happyDOM.close();});
test('signout invalidates a late billing response',async()=>{let release;const pending=new Promise(r=>{release=r});const ui=createBillingController({sb:{rpc:()=>pending,from:()=>({select:()=>({order:async()=>({data:[]})})}),functions:{invoke:async()=>({data:{configured:false}})}},redraw(){},escape});const loading=ui.load('private-company');ui.reset();release({data:{seats:99}});await loading;assert.equal(ui.state.summary,null);assert.equal(ui.state.company,null);});

test('Boss keeps effective billing status while Stripe provider is unreachable',async()=>{
 const w=new Window();
 const sb={
  rpc:async name=>({data:name==='essential_billing_summary'?{status:'restricted',active_humans:3,seats:5,has_subscription:true,test_company:false}:null}),
  from:()=>({select:()=>({order:async()=>({data:[{id:'essential',title:'Essentiel'}],error:null})})}),
  functions:{invoke:async()=>({error:new Error('Provider inaccessible')})}
 };
 const ui=createBillingController({sb,redraw(){},escape,document:w.document});
 await ui.load('company-test');
 assert.equal(ui.state.summary.status,'restricted');
 assert.equal(ui.state.configured,false);
 assert.match(ui.render(),/Service Stripe indisponible/);
 assert.match(ui.render(),/restricted/);
 await w.happyDOM.close();
});

test('Boss sees approved negotiated offer and must preview it in Stripe before confirmation',async()=>{
 const w=new Window(),calls=[];
 const sb={
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='essential_company_price_order'?'price-order':name==='essential_company_price_offer'?null:null};},
  functions:{invoke:async(_name,args)=>{calls.push({name:'edge',action:args.body.action,orderId:args.body.orderId});return {data:{preview:{amount_due:225,total:225,effective_at:1780000000,expires_at:1780000600}}};}}
 };
 const ui=createBillingController({sb,redraw(){},escape,document:w.document});
 ui.state.company='tenant';ui.state.configured=true;
 ui.state.summary={status:'active',active_humans:4,seats:5,has_subscription:true,test_company:false};
 ui.state.plans=[{id:'essential_plus',title:'Plus'}];
 ui.state.offer={approval_version:4,plan_id:'essential_plus',title:'Plus',seats:7,due_cents:2199,cadence:'monthly',effective_on:'2026-10-25',available:true};
 w.document.body.innerHTML=ui.render();
 assert.ok(w.document.querySelector('[data-action="bill:offer"]'));
 await ui.handle({dataset:{action:'bill:offer'}});
 assert.equal(ui.state.order,'price-order');
 assert.equal(ui.state.preview.amount_due,225);
 assert.ok(calls.some(c=>c.name==='essential_company_price_order'&&c.args.p_approval_version===4));
 assert.ok(calls.some(c=>c.name==='edge'&&c.action==='preview'&&c.orderId==='price-order'));
 assert.equal(calls.filter(c=>c.action==='confirm').length,0);
 await w.happyDOM.close();
});
test('unavailable negotiated offer or disabled Stripe does not create an order',async()=>{
 const w=new Window(),calls=[];
 const ui=createBillingController({sb:{rpc:async(name,args)=>{calls.push(name);return {data:null}},functions:{invoke:async()=>({data:{}})}},redraw(){},escape,document:w.document});
 ui.state.company='tenant';ui.state.summary={status:'active',active_humans:2,seats:5,has_subscription:false,test_company:false};
 ui.state.offer={approval_version:1,plan_id:'essential',title:'Essentiel',seats:5,due_cents:1900,cadence:'monthly',effective_on:'2026-11-01',available:false};
 ui.state.configured=false;
 await ui.handle({dataset:{action:'bill:offer'}});
 assert.match(ui.state.error,/Offre non disponible/);
 assert.deepEqual(calls,[]);
 await w.happyDOM.close();
});
