import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261101190000_essential_chat_plan_gate.sql');
const acceptance=read('supabase/tests/essential_chat_entitlements.sql');
const original=read('supabase/migrations/20261024035200_punch_360_team_chat_v1.sql');

test('Essentiel chat entitlement gates existing shared RLS membership instead of introducing unrestricted policy',()=>{
 assert.match(sql,/private\.essential_feature\(c\.id,'messages'\)/);
 assert.match(sql,/c\.product_edition='construction'/);
 assert.match(sql,/create or replace function private\.is_chat_member/);
 assert.match(sql,/private\.company_chat_enabled\(cm\.company_id\)/);
 assert.doesNotMatch(sql,/create policy.*allow.*all/i);
 assert.match(original,/create policy chat_messages_write/);
 assert.match(original,/private\.is_chat_member\(conversation_id\)/);
});
test('All chat RPC creation paths retain their current definitions and receive an entitlement guard',()=>{
 for(const fn of ['create_company_group','create_private_team_chat','add_group_member'])
  assert.ok(sql.includes("'"+fn+"'"),fn);
 assert.match(sql,/pg_get_functiondef\(f\.oid\)/);
 assert.match(sql,/private\.assert_company_chat_enabled/);
 assert.match(sql,/if count_changed<>3 then raise exception/);
 assert.match(acceptance,/Basic direct message insert succeeded/);
 assert.match(acceptance,/Basic private team chat succeeded/);
 assert.match(acceptance,/Pro upgrade did not recover saved Plus message/);
 assert.match(acceptance,/Construction message blocked/);
 assert.match(acceptance,/Cross-company conversation visibility incorrect/);
 assert.match(acceptance,/^(?:\s*--[^\n]*\n)*\s*begin;[\s\S]*rollback;\s*$/);
});
