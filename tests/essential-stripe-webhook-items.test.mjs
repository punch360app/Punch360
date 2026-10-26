import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripeWebhookSubscriptionPrice} from '../supabase/functions/_shared/stripe.mjs';

const item={id:'si_123456789',quantity:1,price:{id:'price_123456789',type:'recurring',currency:'cad',unit_amount:1900,livemode:false,recurring:{interval:'month'}}};
const sub={id:'sub_123456789',livemode:false,items:{object:'list',data:[item],has_more:false}};
const reject=x=>assert.throws(()=>stripeWebhookSubscriptionPrice(x),/STRIPE_SUBSCRIPTION_ITEMS_UNVERIFIED/);

test('P0-B webhook resolves only a single CAD subscription item with quantity one',()=>{
 assert.equal(stripeWebhookSubscriptionPrice(sub),item.price.id);
 assert.equal(stripeWebhookSubscriptionPrice({...sub,livemode:true,items:{...sub.items,data:[{...item,price:{...item.price,livemode:true}}]}}),item.price.id);
 assert.equal(stripeWebhookSubscriptionPrice({...sub,items:{...sub.items,data:[{...item,price:{...item.price,recurring:{interval:'year'}}}]}}),item.price.id);
});

test('P0-B rejects extra, missing, paginated, or multi-quantity Stripe items',()=>{
 reject(null);
 reject({...sub,items:null});
 reject({...sub,items:{data:[]}});
 reject({...sub,items:{data:[item,item],has_more:false}});
 reject({...sub,items:{data:[item],has_more:true}});
 reject({...sub,items:{data:[{...item,quantity:2}]}});
 reject({...sub,items:{data:[{...item,quantity:0}]}});
 reject({...sub,items:{data:[{...item,quantity:null}]}});
 reject({...sub,items:{data:[{...item,id:'invalid'}]}});
});

test('P0-B rejects unverified or unexpected Stripe prices before RPC',()=>{
 for(const price of [
  null,{...item.price,id:'bad'}, {...item.price,currency:'usd'},
  {...item.price,livemode:true}, {...item.price,type:'one_time'},
  {...item.price,unit_amount:0}, {...item.price,unit_amount:null},
  {...item.price,recurring:{interval:'week'}}
 ])reject({...sub,items:{data:[{...item,price}]}});
 const edge=readFileSync(new URL('../supabase/functions/essential-stripe-webhook/index.ts',import.meta.url),'utf8');
 const guard=edge.indexOf('const priceId=stripeWebhookSubscriptionPrice(sub);');
 const resolve=edge.indexOf("admin.rpc('billing_service_resolve_order'");
 const apply=edge.indexOf("admin.rpc('billing_service_apply'");
 assert.ok(guard>0&&resolve>guard&&apply>resolve,'single-item validation must precede all billing RPCs');
 assert.doesNotMatch(edge,/sub\.items\.data\[0\]\?\.price\?\.id/);
});
