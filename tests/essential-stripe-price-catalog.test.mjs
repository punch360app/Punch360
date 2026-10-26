import test from 'node:test';
import assert from 'node:assert/strict';
import {billingQuote} from '../supabase/functions/_shared/stripe.mjs';
import {planPriceKeys,checkRegisteredPrices,checkStripeProductPair,selectRegisteredPrice,verifyStripeSubscriptionTenant,preflightBillingAction,orderPriceStrategy,checkOrderStripePrice,verifySubscriptionPreview} from '../supabase/functions/_shared/essential-price-catalog.mjs';

const cases=[
 ['essential',1900,19380,20],
 ['essential_plus',3900,39780,25],
 ['essential_pro',6900,70380,50]
];
function fixtures(plan,base,annual,live=false){
 const keys=planPriceKeys(plan);
 const registered=[
  {id:keys.monthly,stripe_price_id:'price_12345678monthly',amount_cents:base,currency:'cad',billing_interval:'month',active:true},
  {id:keys.yearly,stripe_price_id:'price_12345678yearly',amount_cents:annual,currency:'cad',billing_interval:'year',active:true}
 ];
 const remote={
  monthly:{id:registered[0].stripe_price_id,active:true,livemode:live,currency:'cad',unit_amount:base,billing_scheme:'per_unit',type:'recurring',recurring:{interval:'month',interval_count:1},product:'prod_12345678'},
  yearly:{id:registered[1].stripe_price_id,active:true,livemode:live,currency:'cad',unit_amount:annual,billing_scheme:'per_unit',type:'recurring',recurring:{interval:'year',interval_count:1},product:'prod_12345678'}
 };
 return {registered,remote};
}
test('owner-approved catalog 20/25/50 seats, +2 CAD per member, annual -15%',()=>{
 for(const [plan,base,annual,included] of cases){
  const rule={base_cents:base,included_seats:included,extra_seat_cents:200,annual_discount:15};
  assert.equal(billingQuote(rule,included,'monthly').amount_cents,base,plan);
  assert.equal(billingQuote(rule,included+1,'monthly').amount_cents,base+200,plan);
  assert.equal(billingQuote(rule,included,'yearly').amount_cents,annual,plan);
  assert.equal(billingQuote(rule,included+1,'yearly').amount_cents,annual+2040,plan);
 }
});
test('all six saved Price IDs are selected by plan and cadence, not matching amounts across plans',()=>{
 for(const [plan,base,annual] of cases){
  const {registered,remote}=fixtures(plan,base,annual);
  const rows=checkRegisteredPrices(plan,registered);
  assert.equal(checkStripeProductPair(rows,remote,false),'prod_12345678');
  assert.equal(selectRegisteredPrice(rows,'monthly',base),registered[0].stripe_price_id);
  assert.equal(selectRegisteredPrice(rows,'yearly',annual),registered[1].stripe_price_id);
  assert.equal(selectRegisteredPrice(rows,'monthly',base+200),null,'additional human seat is not another plan base');
 }
 assert.equal(planPriceKeys('essential_plus').monthly,'punch_pro_monthly');
 assert.equal(planPriceKeys('essential_pro').yearly,'punch_entreprise_yearly');
 assert.throws(()=>planPriceKeys('construction'),/UNKNOWN_ESSENTIAL_PLAN/);
});
test('registered Price IDs reject missing, stale, duplicate, wrong currency or wrong interval',()=>{
 const {registered}=fixtures('essential',1900,19380);
 const mutate=(index,change)=>registered.map((row,i)=>i===index?{...row,...change}:row);
 assert.throws(()=>checkRegisteredPrices('essential',registered.slice(0,1)),/INCOMPLETE/);
 assert.throws(()=>checkRegisteredPrices('essential',mutate(0,{currency:'usd'})),/INVALID/);
 assert.throws(()=>checkRegisteredPrices('essential',mutate(0,{active:false})),/INVALID/);
 assert.throws(()=>checkRegisteredPrices('essential',mutate(1,{billing_interval:'month'})),/INVALID/);
 assert.throws(()=>checkRegisteredPrices('essential',mutate(1,{stripe_price_id:registered[0].stripe_price_id})),/DUPLICATE/);
 assert.throws(()=>checkRegisteredPrices('essential',mutate(0,{stripe_price_id:'id'})),/INVALID/);
});
test('provider confirms both prices belong to one existing product, CAD, correct interval and Stripe mode',()=>{
 const {registered,remote}=fixtures('essential_plus',3900,39780);
 const rows=checkRegisteredPrices('essential_plus',registered);
 for(const [cadence,change] of [
  ['monthly',{unit_amount:6900}],['yearly',{currency:'usd'}],['yearly',{livemode:true}],
  ['yearly',{active:false}],['yearly',{recurring:{interval:'month'}}],
  ['monthly',{product:'prod_87654321'}],['monthly',{id:'price_unrelated'}]
 ]){
  assert.throws(()=>checkStripeProductPair(rows,{...remote,[cadence]:{...remote[cadence],...change}},false),/STRIPE_/);
 }
 assert.equal(checkStripeProductPair(rows,fixtures('essential_plus',3900,39780,true).remote,true),'prod_12345678');
});
test('unknown/negative prices never fall through to a fabricated Stripe subscription',()=>{
 const {registered}=fixtures('essential_pro',6900,70380);
 const rows=checkRegisteredPrices('essential_pro',registered);
 assert.throws(()=>selectRegisteredPrice(rows,'weekly',6900),/INVALID_ORDER_PRICE/);
 assert.throws(()=>selectRegisteredPrice(rows,'monthly',-1),/INVALID_ORDER_PRICE/);
 assert.throws(()=>selectRegisteredPrice(rows,'yearly',Number.MAX_SAFE_INTEGER),/INVALID_ORDER_PRICE/);
});

test('subscription confirmation accepts only the exact, fresh, previously previewed Stripe price',()=>{
 const now=1_800_000_000,subscription={id:'sub_test_1',pending_update:null,items:{data:[{id:'si_1',price:{id:'price_old_12345678'}}]}};
 const item=subscription.items.data[0],price='price_12345678new';
 const preview={price_id:price,subscription_id:subscription.id,item_id:item.id,subscription_price:item.price.id,proration_date:now-30,expires_at:now+570};
 assert.equal(verifySubscriptionPreview(preview,subscription,item,price,now),preview);
 const changes=[
  {price_id:'price_other_12345678'}, {subscription_id:'sub_other'},
  {item_id:'si_other'}, {subscription_price:'price_changed_12345678'},
  {expires_at:now-1}, {expires_at:now+571}, {proration_date:now+1}
 ];
 for(const change of changes)assert.throws(()=>verifySubscriptionPreview({...preview,...change},subscription,item,price,now),/PREVIEW_EXPIRED/,JSON.stringify(change));
 assert.throws(()=>verifySubscriptionPreview(preview,subscription,item,'price_12345678different',now),/PREVIEW_EXPIRED/);
 assert.throws(()=>verifySubscriptionPreview(preview,subscription,item,price,now+570),/PREVIEW_EXPIRED/);
 assert.throws(()=>verifySubscriptionPreview(preview,{...subscription,pending_update:{}},item,price,now),/PREVIEW_EXPIRED/);
 assert.throws(()=>verifySubscriptionPreview(preview,{...subscription,items:{data:[item,item]}},item,price,now),/PREVIEW_EXPIRED/);
 assert.throws(()=>verifySubscriptionPreview(null,subscription,item,price,now),/PREVIEW_EXPIRED/);
});


test('confirm is READ-ONLY for Stripe Prices: custom offers reuse previewed ID',()=>{
 const standard='price_12345678monthly',custom='price_12345678offer';
 assert.deepEqual(orderPriceStrategy('checkout',standard,null),{kind:'fetch',priceId:standard});
 assert.deepEqual(orderPriceStrategy('preview',standard,null),{kind:'fetch',priceId:standard});
 assert.deepEqual(orderPriceStrategy('checkout',null,null),{kind:'create',priceId:null});
 assert.deepEqual(orderPriceStrategy('preview',null,null),{kind:'create',priceId:null});
 assert.deepEqual(orderPriceStrategy('confirm',null,{price_id:custom}),{kind:'fetch',priceId:custom});
 assert.deepEqual(orderPriceStrategy('confirm',standard,{price_id:standard}),{kind:'fetch',priceId:standard});
 assert.throws(()=>orderPriceStrategy('confirm',null,null),/PREVIEW_EXPIRED/);
 assert.throws(()=>orderPriceStrategy('confirm',null,{price_id:'fake_price'}),/PREVIEW_EXPIRED/);
 assert.throws(()=>orderPriceStrategy('confirm',standard,{price_id:custom}),/PREVIEW_EXPIRED/);
 assert.throws(()=>orderPriceStrategy('confirm',standard,null),/PREVIEW_EXPIRED/);
 assert.throws(()=>orderPriceStrategy('unknown',null,null),/INVALID_BILLING_ACTION/);
});
test('saved custom Stripe Price must match amount, product, cadence, currency and test/live mode',()=>{
 const expectedId='price_12345678offer',productId='prod_12345678';
 const price={id:expectedId,active:true,livemode:false,currency:'cad',unit_amount:2100,
  type:'recurring',billing_scheme:'per_unit',recurring:{interval:'month',interval_count:1},product:productId};
 const args={expectedId,amount:2100,cadence:'monthly',productId,liveMode:false};
 assert.equal(checkOrderStripePrice(price,args),price);
 for(const [field,value] of [
  ['id','price_87654321other'],['active',false],['livemode',true],
  ['currency','usd'],['unit_amount',2200],['type','one_time'],
  ['billing_scheme','tiered'],['product','prod_other123'],
  ['transform_quantity',{divide_by:2,round:'up'}]
 ])assert.throws(()=>checkOrderStripePrice({...price,[field]:value},args),/STRIPE_ORDER_PRICE_UNVERIFIED/,field);
 assert.throws(()=>checkOrderStripePrice({...price,recurring:{interval:'year'}},args),/STRIPE_ORDER_PRICE_UNVERIFIED/);
 assert.throws(()=>checkOrderStripePrice({...price,recurring:{interval:'month',interval_count:2}},args),/STRIPE_ORDER_PRICE_UNVERIFIED/);
 assert.throws(()=>checkOrderStripePrice(price,{...args,amount:0}),/STRIPE_ORDER_PRICE_UNVERIFIED/);
 assert.throws(()=>checkOrderStripePrice(price,{...args,cadence:'yearly'}),/STRIPE_ORDER_PRICE_UNVERIFIED/);
 const yearly={...price,recurring:{interval:'year',interval_count:1}};
 assert.equal(checkOrderStripePrice(yearly,{...args,cadence:'yearly'}),yearly);
});


test('P0-B preflight rejects ineligible checkout BEFORE creating a custom Stripe Price',()=>{
 const subscribed={subscription_id:'sub_12345678',customer_id:'cus_12345678'};
 assert.throws(()=>preflightBillingAction('checkout',subscribed,null),/SUBSCRIPTION_EXISTS_USE_PREVIEW/);
 assert.equal(preflightBillingAction('checkout',{customer_id:'cus_12345678'},null),null);
 assert.equal(preflightBillingAction('checkout',null,null),null);
 assert.throws(()=>preflightBillingAction('unknown',null,null),/INVALID_BILLING_ACTION/);
});
test('P0-B preflight rejects invalid subscription BEFORE Stripe Price creation',()=>{
 const account={subscription_id:'sub_12345678',customer_id:'cus_12345678'};
 const item={id:'si_12345678',price:{id:'price_12345678old'}};
 const sub={id:account.subscription_id,pending_update:null,items:{data:[item]}};
 for(const action of ['preview','confirm']){
  assert.equal(preflightBillingAction(action,account,sub),item);
  assert.throws(()=>preflightBillingAction(action,null,sub),/NO_SUBSCRIPTION/);
  assert.throws(()=>preflightBillingAction(action,account,null),/SUBSCRIPTION_MISMATCH/);
  assert.throws(()=>preflightBillingAction(action,account,{...sub,id:'sub_wrong'}),/SUBSCRIPTION_MISMATCH/);
  assert.throws(()=>preflightBillingAction(action,account,{...sub,pending_update:{expires_at:123}}),/PENDING_PAYMENT_COMPLETE_FIRST/);
  assert.throws(()=>preflightBillingAction(action,account,{...sub,items:{data:[]}}),/UNSUPPORTED_SUBSCRIPTION_ITEMS/);
  assert.throws(()=>preflightBillingAction(action,account,{...sub,items:{data:[item,item]}}),/UNSUPPORTED_SUBSCRIPTION_ITEMS/);
  assert.throws(()=>preflightBillingAction(action,account,{...sub,items:{data:[{id:item.id,price:{}}]}}),/UNSUPPORTED_SUBSCRIPTION_ITEMS/);
 }
});

test('P0-B Stripe subscription is bound to exact company, customer and test/live mode',()=>{
 const account={subscription_id:'sub_12345678',customer_id:'cus_12345678'};
 const companyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const companyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const sub={id:account.subscription_id,customer:account.customer_id,livemode:false,
  metadata:{punch_company:companyA},items:{data:[{id:'si_12345678',price:{id:'price_12345678'}}]}};
 assert.equal(verifyStripeSubscriptionTenant(account,sub,companyA,false),sub);
 assert.equal(verifyStripeSubscriptionTenant(account,{...sub,customer:{id:account.customer_id}},companyA,false).id,sub.id);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,sub,companyB,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,{...sub,customer:'cus_other123'},companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,{...sub,id:'sub_other123'},companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,{...sub,metadata:{}},companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,{...sub,metadata:{punch_company:companyB}},companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,{...sub,livemode:true},companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,sub,companyA,true),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant({...account,customer_id:null},sub,companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,null,companyA,false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,sub,'',false),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.throws(()=>verifyStripeSubscriptionTenant(account,sub,companyA,'test'),/SUBSCRIPTION_TENANT_MISMATCH/);
 assert.equal(verifyStripeSubscriptionTenant(account,{...sub,livemode:true},companyA,true).livemode,true);
});
