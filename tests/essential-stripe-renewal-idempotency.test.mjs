import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {stripeRenewalIdempotencyKey} from '../supabase/functions/_shared/essential-price-catalog.mjs';
import {createBillingController} from '../web/live/billing.js';

const COMPANY_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPANY_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SUB='sub_1234567890abcd';
const ID1='12345678-1234-4234-8234-123456789abc';
const ID2='87654321-1234-4123-9123-abcdefabcdef';

test('each Stripe renewal idempotency key scopes company, subscription, action, and UUIDv4',()=>{
 const k=stripeRenewalIdempotencyKey(COMPANY_A,SUB,'cancel',ID1);
 assert.equal(k,'punch-renewal:'+COMPANY_A+':'+SUB+':cancel:'+ID1);
 assert.equal(stripeRenewalIdempotencyKey(COMPANY_A,SUB,'cancel',ID1),k,
  'retrying the same intent produces the same key');
 assert.notEqual(stripeRenewalIdempotencyKey(COMPANY_A,SUB,'resume',ID1),k);
 assert.notEqual(stripeRenewalIdempotencyKey(COMPANY_B,SUB,'cancel',ID1),k);
 assert.notEqual(stripeRenewalIdempotencyKey(COMPANY_A,'sub_abcdef123456','cancel',ID1),k);
 assert.notEqual(stripeRenewalIdempotencyKey(COMPANY_A,SUB,'cancel',ID2),k);
 assert.ok(k.length<255);
});

test('reject missing, predictable, malformed or injected IDs before Stripe GET/POST',()=>{
 for(const id of [null,undefined,'','undefined','1234567890123','20261026110100',
  '00000000-0000-0000-0000-000000000000',
  '12345678-1234-1234-8234-123456789abc',
  ID1+'\n',ID1+':other','🔥']){
  assert.throws(()=>stripeRenewalIdempotencyKey(COMPANY_A,SUB,'cancel',id),/INVALID_RENEWAL_REQUEST_ID/);
 }
 for(const bad of [null,'not-a-company'])assert.throws(
  ()=>stripeRenewalIdempotencyKey(bad,SUB,'cancel',ID1),/INVALID_RENEWAL_REQUEST_ID/);
 for(const bad of [null,'sub_bad','cus_123456789'])assert.throws(
  ()=>stripeRenewalIdempotencyKey(COMPANY_A,bad,'cancel',ID1),/INVALID_RENEWAL_REQUEST_ID/);
 assert.throws(()=>stripeRenewalIdempotencyKey(COMPANY_A,SUB,'checkout',ID1),/INVALID_RENEWAL_REQUEST_ID/);
});

test('Edge checks idempotency before provider subscription reads and mutation',()=>{
 const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
 const block=edge.slice(edge.indexOf("if(['cancel','resume'].includes(body.action))"),edge.indexOf("if(!o)throw Error('ORDER_REQUIRED')"));
 const guard=block.indexOf('const key=stripeRenewalIdempotencyKey(');
 const read=block.indexOf('const current=await stripe(');
 const write=block.indexOf('const sub=await stripe(');
 assert.ok(guard>0&&read>guard&&write>read,'provider reads/writes follow valid idempotency key');
 assert.ok(block.includes('body.companyId,a.subscription_id,body.action,body.requestId'));
 assert.ok(block.includes("body.action==='cancel'},key"));
 assert.ok(!block.includes(':${body.requestId}'),'cannot interpolate missing request IDs');
});

test('native app uses cryptographic v4 UUID, not timestamp-only token',()=>{
 const source=readFileSync(new URL('../src/billing/BillingPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/import \* as Crypto from 'expo-crypto'/);
 assert.match(source,/Crypto\.randomUUID\(\)/);
 assert.match(source,/renewalAttempt\.current=\{company:account\.companyId,action,id\}/);
 assert.doesNotMatch(source,/requestId:Date\.now\(\)\.toString\(\)/);
});

test('web reuses one UUID after uncertain failure, never across companies',async()=>{
 const w=new Window(),mutations=[];
 const sb={rpc:async()=>({data:null}),functions:{invoke:async(_n,opts)=>{
  mutations.push(opts.body);
  return {error:new Error('response lost')};
 }}};
 const ui=createBillingController({sb,redraw(){},escape:s=>String(s),document:w.document});
 const arrange=company=>{
  ui.state.company=company;
  ui.state.summary={has_subscription:true,canceled:true,status:'active',active_humans:1,seats:20,test_company:false};
  ui.state.configured=true;
 };
 arrange(COMPANY_A);
 await ui.handle({dataset:{action:'bill:resume'}});
 await ui.handle({dataset:{action:'bill:resume'}});
 assert.equal(mutations.length,2);
 assert.equal(mutations[0].requestId,mutations[1].requestId,
  'uncertain repeated decision must keep the original provider idempotency key');
 assert.match(mutations[0].requestId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
 ui.reset();arrange(COMPANY_B);
 await ui.handle({dataset:{action:'bill:resume'}});
 assert.equal(mutations[2].companyId,COMPANY_B);
 assert.notEqual(mutations[2].requestId,mutations[0].requestId);
 await w.happyDOM.close();
});
