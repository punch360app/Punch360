import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preflightStripeOrderCustomer} from '../supabase/functions/_shared/essential-price-catalog.mjs';

const companyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const companyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const account={customer_id:'cus_12345678'};
const customer={object:'customer',id:account.customer_id,livemode:false,deleted:false,
 metadata:{punch_company:companyA}};

test('existing Customer is fetched and validated for all three billing actions',async()=>{
 for(const action of ['checkout','preview','confirm']){
  const calls=[];
  const api=async(path)=>{calls.push(path);return customer;};
  assert.equal(await preflightStripeOrderCustomer(action,account,companyA,false,api),customer);
  assert.deepEqual(calls,[`/customers/${account.customer_id}`]);
 }
});
test('first Checkout with no Customer does not call provider; preview/confirm fail closed',async()=>{
 const calls=[];
 const api=async(path)=>{calls.push(path);return customer;};
 assert.equal(await preflightStripeOrderCustomer('checkout',null,companyA,false,api),null);
 assert.equal(await preflightStripeOrderCustomer('checkout',{},companyA,false,api),null);
 for(const action of ['preview','confirm'])
  await assert.rejects(preflightStripeOrderCustomer(action,null,companyA,false,api),/NO_CUSTOMER/);
 assert.deepEqual(calls,[]);
 await assert.rejects(preflightStripeOrderCustomer('refund',account,companyA,false,api),/INVALID_BILLING_ACTION/);
});
test('incorrect provider Customer never passes the preflight',async()=>{
 const cases=[
  {...customer,id:'cus_other123'}, {...customer,livemode:true},
  {...customer,deleted:true}, {...customer,metadata:{}},
  {...customer,metadata:{punch_company:companyB}}
 ];
 for(const bad of cases){
  await assert.rejects(
   preflightStripeOrderCustomer('checkout',account,companyA,false,async()=>bad),
   /STRIPE_CUSTOMER_TENANT_MISMATCH/);
 }
 await assert.rejects(
  preflightStripeOrderCustomer('preview',account,companyB,false,async()=>customer),
  /STRIPE_CUSTOMER_TENANT_MISMATCH/);
 await assert.rejects(
  preflightStripeOrderCustomer('checkout',account,companyA,false,async()=>{throw Error('provider unavailable');}),
  /provider unavailable/);
});
test('Stripe Customer preflight occurs before custom Price or Customer creation',()=>{
 const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const guard=edge.indexOf('const existingCustomer=await preflightStripeOrderCustomer(');
 const price=edge.indexOf("await stripe('/prices',{");
 const createCustomer=edge.indexOf("await stripe('/customers',{");
 const existingCheckout=edge.indexOf('const customer=existingCustomer??');
 assert.ok(guard!==-1,'order Customer preflight must be present');
 assert.ok(price>guard,'no Price POST before Customer preflight');
 assert.ok(createCustomer>guard,'no new Customer POST before preflight');
 assert.ok(existingCheckout>guard,'Checkout reuses validated Customer');
 assert.match(edge,/preflightStripeOrderCustomer\(\s*body\.action,a,body\.companyId,liveMode,stripe\)/);
});
