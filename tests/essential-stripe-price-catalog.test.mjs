import test from 'node:test';
import assert from 'node:assert/strict';
import {billingQuote} from '../supabase/functions/_shared/stripe.mjs';
import {planPriceKeys,checkRegisteredPrices,checkStripeProductPair,selectRegisteredPrice,verifySubscriptionPreview} from '../supabase/functions/_shared/essential-price-catalog.mjs';

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
