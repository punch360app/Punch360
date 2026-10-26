import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutExpiryFromOrder} from '../supabase/functions/_shared/stripe.mjs';

const now=Date.parse('2026-10-26T10:00:00.000Z');
const at=millis=>new Date(millis).toISOString();

test('new Checkout quote expires at the original 60-minute order deadline',()=>{
 assert.equal(checkoutExpiryFromOrder(at(now),now),Math.floor(now/1000)+3600);
 assert.equal(checkoutExpiryFromOrder(at(now-20*60*1000),now),Math.floor(now/1000)+2400);
 assert.equal(checkoutExpiryFromOrder(at(now-29*60*1000),now),Math.floor(now/1000)+1860);
});
test('quote older than 29 minutes cannot trigger Stripe Price or Customer creation',()=>{
 assert.throws(()=>checkoutExpiryFromOrder(at(now-29*60*1000-1000),now),/CHECKOUT_ORDER_TOO_OLD/);
 assert.throws(()=>checkoutExpiryFromOrder(at(now-60*60*1000),now),/CHECKOUT_ORDER_TOO_OLD/);
 assert.throws(()=>checkoutExpiryFromOrder(at(now-61*60*1000),now),/CHECKOUT_ORDER_TOO_OLD/);
});
test('malformed or future order dates fail closed',()=>{
 for(const bad of [null,undefined,42,'','not-a-date','2026-99-99'])
  assert.throws(()=>checkoutExpiryFromOrder(bad,now),/INVALID_CHECKOUT_ORDER_TIME/);
 assert.throws(()=>checkoutExpiryFromOrder(at(now+61*1000),now),/INVALID_CHECKOUT_ORDER_TIME/);
 assert.throws(()=>checkoutExpiryFromOrder(at(now),NaN),/INVALID_CHECKOUT_ORDER_TIME/);
 assert.throws(()=>checkoutExpiryFromOrder(at(now),-1),/INVALID_CHECKOUT_ORDER_TIME/);
});
test('Checkout expiry is validated before Stripe Price and Customer mutations in Edge',()=>{
 const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const guard=edge.indexOf('checkoutExpiryFromOrder(o.created_at)');
 const price=edge.indexOf("await stripe('/prices',{");
 const customer=edge.indexOf("await stripe('/customers',{");
 assert.ok(guard!==-1,'checkout expiry helper is used');
 assert.ok(price>guard,'Price creation must follow the expiration preflight');
 assert.ok(customer>guard,'Customer creation must follow the expiration preflight');
 assert.match(edge,/expires_at:checkoutExpiry/);
 assert.doesNotMatch(edge,/expires_at:Math\.floor\(Date\.parse\(o\.created_at\)/);
});
