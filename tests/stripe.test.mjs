import test from 'node:test';import assert from 'node:assert/strict';
import {billingQuote,stripeClient,verifyStripeSignature,safeHostedUrl,stripeInvoiceSubscriptionId,verifyStripeWebhookInvoice} from '../supabase/functions/_shared/stripe.mjs';
test('owner-approved 20/25/50 seats and +2 CAD: annual discount applies to all seats in integer cents',()=>{for(const [base,included,annual] of [[1900,20,19380],[3900,25,39780],[6900,50,70380]]){const p={base_cents:base,included_seats:included,extra_seat_cents:200,annual_discount:15};assert.equal(billingQuote(p,included,'yearly').amount_cents,annual);assert.equal(billingQuote(p,included+2,'yearly').amount_cents,annual+4080);assert.equal(billingQuote(p,included+2,'monthly').amount_cents,base+400);}assert.throws(()=>billingQuote({},0,'monthly'));});
test('Stripe form encoding, idempotency, sanitised provider errors',async()=>{let request;const call=stripeClient('sk_test_fake',async(u,o)=>{request={u,o};return {ok:true,json:async()=>({id:'cs_test'})};});await call('/checkout/sessions',{line_items:[{price:'price_abc',quantity:1}],automatic_tax:{enabled:true}},'order-1');assert.equal(request.o.headers['Idempotency-Key'],'order-1');assert.equal(request.o.body.get('line_items[0][price]'),'price_abc');assert.equal(request.o.body.get('automatic_tax[enabled]'),'true');await assert.rejects(call('https://evil.test'),/INVALID_STRIPE_PATH/);const denied=stripeClient('sk_test_fake',async()=>({ok:false,status:401,json:async()=>({error:{code:'invalid_api_key',message:'secret'}})}));await assert.rejects(denied('/customers'),e=>!e.message.includes('secret')&&e.message.includes('401'));});
test('webhooks require raw-body HMAC, five minute timestamp, supports key rotation',async()=>{const t=Math.floor(Date.now()/1000),raw='{"id":"evt_1"}',secret='whsec_test';const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const hash=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${raw}`))).toString('hex');assert.equal((await verifyStripeSignature(raw,`t=${t},v1=invalid,v1=${hash}`,secret)).id,'evt_1');await assert.rejects(verifyStripeSignature(raw+' ',`t=${t},v1=${hash}`,secret));await assert.rejects(verifyStripeSignature(raw,`t=${t},v1=${hash}`,secret,(t+301)*1000));});
test('hosted redirect limited to Stripe HTTPS hosts',()=>{assert.equal(new URL(safeHostedUrl('https://checkout.stripe.com/c/pay/test')).hostname,'checkout.stripe.com');for(const u of ['javascript:alert(1)','https://checkout.stripe.com.evil.test','http://billing.stripe.com'])assert.throws(()=>safeHostedUrl(u));});


test('invoice webhooks resolve both legacy subscription and modern parent.subscription_details',()=>{
 const sub='sub_1234567890';
 assert.equal(stripeInvoiceSubscriptionId({subscription:sub}),sub);
 assert.equal(stripeInvoiceSubscriptionId({parent:{subscription_details:{subscription:sub}}}),sub);
 assert.equal(stripeInvoiceSubscriptionId({subscription:{id:sub},parent:{subscription_details:{subscription:{id:sub}}}}),sub);
 assert.equal(stripeInvoiceSubscriptionId({subscription:sub,parent:{subscription_details:{subscription:sub}}}),sub);
 assert.equal(stripeInvoiceSubscriptionId({parent:null}),null);
 assert.equal(stripeInvoiceSubscriptionId({subscription:'invalid'}),null);
 assert.throws(()=>stripeInvoiceSubscriptionId({subscription:sub,parent:{subscription_details:{subscription:'sub_foreign'}}}),/STRIPE_INVOICE_SUBSCRIPTION_MISMATCH/);
});
test('invoice webhook refuses cross-company, cross-subscription, wrong mode or currency',()=>{
 const sub={id:'sub_1234567890',customer:'cus_1234567890',livemode:false};
 const invoice={id:'in_1234567890',object:'invoice',customer:sub.customer,livemode:false,currency:'cad',parent:{subscription_details:{subscription:sub.id}}};
 assert.equal(verifyStripeWebhookInvoice(invoice,sub,false),invoice);
 assert.equal(verifyStripeWebhookInvoice({...invoice,customer:{id:sub.customer}},sub,false).id,invoice.id);
 assert.equal(verifyStripeWebhookInvoice({...invoice,parent:null,subscription:sub.id},sub,false).id,invoice.id);
 const bad=[
  {...invoice,customer:'cus_other123'},
  {...invoice,parent:{subscription_details:{subscription:'sub_other123'}}},
  {...invoice,parent:null},
  {...invoice,livemode:true},
  {...invoice,currency:'usd'},
  {...invoice,object:'charge'},
  {...invoice,id:'upcoming_in_123456'},
 ];
 for(const x of bad)assert.throws(()=>verifyStripeWebhookInvoice(x,sub,false),/STRIPE_INVOICE_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeWebhookInvoice(invoice,{...sub,customer:'cus_other123'},false),/STRIPE_INVOICE_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeWebhookInvoice(invoice,{...sub,livemode:true},false),/STRIPE_INVOICE_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeWebhookInvoice(invoice,sub,true),/STRIPE_INVOICE_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeWebhookInvoice(null,sub,false),/STRIPE_INVOICE_TENANT_MISMATCH/);
});
