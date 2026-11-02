import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const draftPath=new URL('../supabase/drafts/kiosk-qr-credential-registry.sql',import.meta.url);
const sql=readFileSync(draftPath,'utf8');
const acceptance=readFileSync(new URL('../supabase/drafts/kiosk-qr-credential-acceptance.sql',import.meta.url),'utf8');
const fn=name=>{
 const beginning=sql.indexOf('create function public.'+name+'(');
 assert.ok(beginning>=0,'Expected staged function '+name);
 const after=sql.indexOf('end $$;',beginning);
 assert.ok(after>beginning,'Missing function close: '+name);
 return sql.slice(beginning,after+7);
};

test('QR registry is a draft rather than a deployable migration or enabled QR RPC',()=>{
 assert.match(draftPath.pathname,/\/supabase\/drafts\//);
 assert.match(sql,/NOT A MIGRATION; NEVER AUTOMATICALLY APPLIED/);
 assert.match(sql,/no QR-to-identity verifier, no QR-to-punch RPC/i);
 assert.doesNotMatch(sql,/create (?:or replace )?function (?:public|private)\.kiosk_qr_execute\(/i);
});
test('private employee card and enrollment tables are never exposed to API roles',()=>{
 for(const table of ['kiosk_qr_enrollments','kiosk_qr_cards']){
  assert.match(sql,new RegExp('create table private\\.'+table+' \\('));
  assert.match(sql,new RegExp('alter table private\\.'+table+' enable row level security;'));
  assert.match(sql,new RegExp('revoke all on table private\\.'+table+' from public,anon,authenticated;'));
 }
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete|all) on table private\.kiosk_qr_/i);
 assert.match(sql,/foreign key \(company_id,worker_id\) references public\.company_workers\(company_id,id\)/);
});
test('random card secrets are not stored in plaintext and active cards are unique',()=>{
 assert.match(sql,/extensions\.gen_random_bytes\(32\)/);
 assert.match(sql,/token_hash bytea not null unique/g);
 assert.match(sql,/sha256\(convert_to\(card_code,'UTF8'\)\)/);
 assert.match(sql,/create unique index kiosk_qr_one_active_worker[\s\S]*?on private\.kiosk_qr_cards\(company_id,worker_id\) where revoked_at is null;/);
 assert.doesNotMatch(sql,/create table private\.kiosk_qr_cards\s*\([\s\S]*?\b(?:token|card_code) text[,\s]/);
});
test('sensitive functions use explicit scoped checks and are not granted to public or anon',()=>{
 const issue=fn('create_worker_qr_enrollment');
 const activate=fn('activate_my_kiosk_qr_card');
 const self=fn('revoke_my_kiosk_qr_card');
 const admin=fn('revoke_worker_kiosk_qr_card');
 for(const f of [issue,activate,self,admin]){
  assert.match(f,/security definer set search_path=''/);
  assert.match(f,/company_id/);
  assert.match(f,/worker_id/);
 }
 assert.match(issue,/private\.can_administer\(w\.company_id\)/);
 assert.match(activate,/auth\.uid\(\)/);
 assert.match(activate,/auth_user_id=auth\.uid\(\)/);
 assert.match(activate,/private\.kiosk_qr_enrollments/);
 assert.match(activate,/consumed_at is not null or challenge\.revoked_at is not null/);
 assert.match(activate,/challenge\.expires_at<=now_at/);
 assert.match(self,/auth_user_id=auth\.uid\(\)/);
 assert.match(admin,/private\.is_manager\(w\.company_id\)/);
 for(const name of ['create_worker_qr_enrollment','activate_my_kiosk_qr_card','revoke_my_kiosk_qr_card','revoke_worker_kiosk_qr_card']){
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'\\('));
 }
 assert.match(sql,/to authenticated;/);
 assert.doesNotMatch(sql,/grant execute on function [\s\S]*?to\s+(?:public|anon)\s*;/i);
});
test('worker change revokes every card and unused challenge in the same transaction',()=>{
 assert.match(sql,/create trigger revoke_kiosk_qr_on_worker_change/);
 assert.match(sql,/after update of status,can_kiosk_punch,personal_access,auth_user_id,role,company_id/);
 assert.match(sql,/update private\.kiosk_qr_cards set revoked_at=clock_timestamp\(\)/);
 assert.match(sql,/update private\.kiosk_qr_enrollments set revoked_at=clock_timestamp\(\)/);
 assert.match(sql,/revoked_at=now_at[\s\S]*?where company_id=p_company and worker_id=w\.id and revoked_at is null/);
});
test('draft SQL acceptance plan is rollback-only, with no live customer fixture',()=>{
 assert.match(acceptance,/^begin;/m);
 assert.match(acceptance,/rollback;\s*$/m);
 for(const caseName of ['Foreign-company activation succeeded','Enrollment replay succeeded','Old card not revoked on rotation','Self revocation left an active card','Disabled worker activated a card']){
  assert.ok(acceptance.includes(caseName),'Missing scenario '+caseName);
 }
 assert.doesNotMatch(acceptance,/(?:punch360app@gmail\.com|@gmail\.com|@outlook\.com)/i);
});

test('QR membership changes revoke independent of worker synchronization',()=>{
 assert.match(sql,/create function private\.revoke_kiosk_qr_on_membership_change\(\)/);
 assert.match(sql,/create trigger revoke_kiosk_qr_on_membership_change/);
 assert.match(sql,/after update of status,role,user_id,company_id or delete/);
 assert.match(sql,/where company_id=old\.company_id and enrolled_user_id=old\.user_id/);
 assert.match(sql,/where company_id=old\.company_id[\s\S]*?worker_id in \([\s\S]*?w\.auth_user_id=old\.user_id/);
 assert.match(sql,/if tg_op='DELETE' then return old;end if;/);
 assert.match(sql,/revoke all on function private\.revoke_kiosk_qr_on_membership_change\(\)/);
 assert.ok(acceptance.includes('Disabled company membership kept QR active'));
 assert.ok(acceptance.includes('Reactivation silently restored an old QR'));
});

test('QR expiration and revocation timestamps refresh only after acquiring row locks',()=>{
 const issue=fn('create_worker_qr_enrollment');
 const activate=fn('activate_my_kiosk_qr_card');
 const self=fn('revoke_my_kiosk_qr_card');
 const admin=fn('revoke_worker_kiosk_qr_card');
 assert.match(issue,/for update;\s*now_at:=clock_timestamp\(\);/);
 assert.match(activate,/token_hash=sha256\(convert_to\(p_enrollment,'UTF8'\)\) for update;\s*now_at:=clock_timestamp\(\);/);
 assert.ok(activate.indexOf('now_at:=clock_timestamp();')<activate.indexOf('challenge.expires_at<=now_at'));
 assert.match(self,/for update;\s*now_at:=clock_timestamp\(\);/);
 assert.match(admin,/for update;\s*now_at:=clock_timestamp\(\);/);
});

test('QR status views report flags without leaking token hash, challenge or installation',()=>{
 const employee=fn('my_kiosk_qr_card_status');
 const manager=fn('list_kiosk_qr_card_status');
 assert.match(employee,/auth\.uid\(\) is null/);
 assert.match(employee,/company_id=p_company and auth_user_id=auth\.uid\(\)/);
 assert.match(employee,/m\.company_id=p_company and m\.user_id=auth\.uid\(\) and m\.status='active'/);
 assert.match(employee,/kiosk_qr_cards/);
 assert.match(employee,/revoked_at is null and expires_at>now\(\)/);
 assert.match(employee,/'active',found/);
 assert.match(manager,/private\.is_manager\(p_company\)/);
 assert.match(manager,/w\.company_id=p_company/);
 assert.match(manager,/k\.enrolled_user_id=w\.auth_user_id/);
 assert.match(manager,/'worker_id',w\.id/);
 for(const call of [employee,manager]){
  assert.match(call,/security definer set search_path=''/);
  assert.doesNotMatch(call,/jsonb_build_object\([\s\S]*?['"](?:token|token_hash|card_code|installation_id|enrollment)['"]\s*,/i);
  assert.doesNotMatch(call,/return\s+(?:token|card_code|card_secret)/i);
 }
 for(const name of ['my_kiosk_qr_card_status','list_kiosk_qr_card_status'])
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'\\(uuid\\) from public,anon,authenticated;'));
 assert.ok(acceptance.includes('Employee read foreign QR status'));
 assert.ok(acceptance.includes('Employee read manager QR status'));
 assert.ok(acceptance.includes('Card secret exposed in own status'));
 assert.ok(acceptance.includes('Manager status leaked card secret'));
 assert.ok(acceptance.includes('Revoked card still reported active'));
});

test('SQL draft functions have balanced PostgreSQL dollar-delimiters',()=>{
 const namedStart=(sql.match(/as \$qr_body\$/g)||[]).length;
 const namedEnd=(sql.match(/end \$qr_body\$;/g)||[]).length;
 assert.ok(namedStart===3 && namedEnd===3,'Named function delimiters must balance');
 assert.doesNotMatch(sql,/as \$(?!\$|[a-zA-Z_])/);
 assert.doesNotMatch(sql,/end \$(?!\$|[a-zA-Z_]);/);
});
test('QR credential revocation remains available under restricted company billing',()=>{
 const issue=fn('create_worker_qr_enrollment');
 const revoke=fn('revoke_worker_kiosk_qr_card');
 const status=fn('list_kiosk_qr_card_status');
 assert.match(issue,/private\.can_administer\(w\.company_id\)/);
 assert.match(revoke,/private\.is_manager\(w\.company_id\)/);
 assert.match(status,/private\.is_manager\(p_company\)/);
 assert.doesNotMatch(revoke,/private\.can_administer/);
});
