import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preflightStripeRenewalAction} from '../supabase/functions/_shared/essential-price-catalog.mjs';

const subscription=(override={})=>({
 status:'active',cancel_at_period_end:false,current_period_end:1800000000,...override
});
test('cancel requests only mutate if the current provider state needs a change',()=>{
 assert.deepEqual(preflightStripeRenewalAction('cancel',subscription()),{
  needsMutation:true,cancelAtPeriodEnd:true
 });
 assert.deepEqual(preflightStripeRenewalAction('cancel',subscription({cancel_at_period_end:true})),{
  needsMutation:false,cancelAtPeriodEnd:true
 });
});
test('resume requests do not resubmit an already resumed subscription',()=>{
 assert.deepEqual(preflightStripeRenewalAction('resume',subscription({cancel_at_period_end:true})),{
  needsMutation:true,cancelAtPeriodEnd:false
 });
 assert.deepEqual(preflightStripeRenewalAction('resume',subscription()),{
  needsMutation:false,cancelAtPeriodEnd:false
 });
});
test('terminal, expired and malformed subscriptions never permit a Stripe mutation',()=>{
 for(const sub of [
  ...['canceled','incomplete_expired','incomplete','',null].map(status=>subscription({status})),
  subscription({cancel_at_period_end:null}),subscription({current_period_end:0}),
  subscription({current_period_end:'1800000000'}),null
 ]){
  for(const action of ['cancel','resume']){
   assert.throws(()=>preflightStripeRenewalAction(action,sub),/SUBSCRIPTION_RENEWAL_UNAVAILABLE/);
  }
 }
 assert.throws(()=>preflightStripeRenewalAction('checkout',subscription()),/INVALID_RENEWAL_ACTION/);
});
test('past_due and trialing provider subscriptions retain standard renewal action',()=>{
 for(const status of ['trialing','past_due','unpaid','paused']){
  assert.equal(preflightStripeRenewalAction('cancel',subscription({status})).needsMutation,true);
 }
});
test('Edge mutation is tenant-validated, state-validated and idempotent',()=>{
 const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const cut=edge.slice(edge.indexOf("if(['cancel','resume'].includes(body.action))"),edge.indexOf("if(!o)throw Error('ORDER_REQUIRED')"));
 const mapping=cut.indexOf('stripeRenewalIdempotencyKey(');
 const tenant=cut.indexOf('verifyStripeSubscriptionTenant(a,current');
 const preflight=cut.indexOf('preflightStripeRenewalAction(body.action,current)');
 const noOp=cut.indexOf('if(!renewal.needsMutation)return response(200');
 const mutation=cut.indexOf('const sub=await stripe(');
 assert.ok(mapping>=0&&tenant>mapping&&preflight>tenant&&noOp>preflight&&mutation>noOp);
 assert.match(cut,/already_applied:true/);
 assert.match(cut,/cancel_at_period_end:renewal.cancelAtPeriodEnd\},key\)/);
});
