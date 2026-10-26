import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {stripeClient} from '../supabase/functions/_shared/stripe.mjs';
import {createBillingController} from '../web/live/billing.js';

test('Stripe client uses bounded 100-invoice provider request with customer filter',async()=>{
 let requested;
 const stripe=stripeClient('sk_test_example',async(url,options)=>{
  requested={url,options};
  return {ok:true,json:async()=>({data:[],has_more:false})};
 });
 const result=await stripe('/invoices?customer=cus_abcdefgh1234&limit=100');
 assert.ok(requested.url.endsWith('/invoices?customer=cus_abcdefgh1234&limit=100'));
 assert.equal(requested.options.method,'GET');
 assert.deepEqual(result.data,[]);
});
test('Edge invoice response reports provider has_more instead of pretending a complete history',()=>{
 const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const block=edge.slice(edge.indexOf("if(body.action==='invoices')"),edge.indexOf("if(body.action==='portal')"));
 assert.match(block,/verifiedCustomer\(\)/);
 assert.match(block,/\/invoices\?customer=\$\{a.customer_id\}&limit=100/);
 assert.match(block,/verifyStripeInvoiceListTenant\(invoices,a.customer_id,liveMode\)/);
 assert.match(block,/has_more:invoices.has_more===true/);
});
test('Boss Web billing distinguishes 100-item limit from complete invoices, clears on account reset',async()=>{
 const w=new Window();
 const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const sb={
  rpc:async(name)=>({data:name==='essential_billing_summary'?{
   status:'active',has_subscription:true,active_humans:5,seats:20,test_company:false
  }:null}),
  from:()=>({select:()=>({order:async()=>({data:[{id:'essential',title:'Essentiel'}]})})}),
  functions:{invoke:async(_,opts)=>({data:opts.body.action==='status'?
   {configured:true}:opts.body.action==='invoices'?
   {invoices:[{id:'in_123456',number:'F-1',status:'paid',total:1900}],has_more:true}:{}
  })}
 };
 const ui=createBillingController({sb,redraw(){},escape:x=>String(x),document:w.document});
 await ui.load(company);
 assert.equal(ui.state.invoices.length,1);
 assert.equal(ui.state.invoicesHasMore,true);
 assert.match(ui.render(),/Seules les 100 dernières factures/);
 ui.reset();
 assert.equal(ui.state.invoicesHasMore,false);
 await w.happyDOM.close();
});
test('mobile invoice UI displays bounded result only when provider has_more',()=>{
 const mobile=readFileSync(new URL('../src/billing/BillingPanel.tsx',import.meta.url),'utf8');
 assert.match(mobile,/setInvoicesHasMore\(i.has_more===true\)/);
 assert.match(mobile,/invoicesHasMore\?<Text/);
 assert.match(mobile,/setInvoicesHasMore\(false\)/);
});
