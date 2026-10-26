import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync(new URL('../supabase/functions/essential-billing/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261026110100_billing_confirm_intent.sql',import.meta.url),'utf8');

test('confirm records submitting before Stripe and submitted only after provider acceptance',()=>{
 const begin=edge.indexOf("const p=verifySubscriptionPreview(o.preview,sub,item,price.id)");
 const block=edge.slice(begin);
 const submitting=block.indexOf("await save({status:'submitting',subscription_id:sub.id}");
 const provider=block.indexOf("const updated=await stripe(`/subscriptions/${sub.id}`");
 const submitted=block.indexOf("await save({status:'submitted',subscription_id:sub.id}");
 assert.ok(begin>0&&submitting>0&&provider>submitting&&submitted>provider,
  'Stripe acceptance must be between submitting and submitted');
 assert.equal((block.match(/await save\(\{status:'submitted'/g)||[]).length,1,
  'only one post-provider submitted write');
});
test('resolver recognizes in-flight confirmation for immediate signed webhooks',()=>{
 assert.match(migration,/create or replace function public\.billing_service_resolve_order/);
 assert.match(migration,/status in \('creating','checkout','submitting','submitted','paid'\)/);
 assert.match(migration,/preview->>'price_id'=p_price/);
 assert.match(migration,/subscription_id=p_subscription or id=p_original/);
});
test('SQL service save cannot downgrade paid contract after a racing webhook',()=>{
 assert.match(migration,/create or replace function public\.billing_service_save/);
 assert.match(migration,/set status=case when status='paid' then status else coalesce\(p_values->>'status',status\) end/);
 for(const col of ['checkout_id','subscription_id','preview']){
  assert.ok(migration.includes(col+"=case when status='paid' then "+col+" else"),
    'paid order must preserve '+col);
 }
 assert.match(migration,/status in \('creating','checkout','submitting','submitted'\)/,
  'other active orders cannot bypass the creating guard');
 assert.match(migration,/grant execute on function public\.billing_service_resolve_order\(uuid,text,text,uuid\) to service_role/);
 assert.match(migration,/grant execute on function public\.billing_service_save\(uuid,uuid,uuid,text,jsonb\) to service_role/);
 assert.doesNotMatch(migration,/truncate|\bdrop table\b|\bdelete from\b/i);
});
