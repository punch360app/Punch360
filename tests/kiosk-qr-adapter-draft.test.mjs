import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../supabase/drafts/kiosk-qr-execute.sql',import.meta.url);
const sql=readFileSync(path,'utf8');
const edge=readFileSync(new URL('../supabase/functions/essential-kiosk/index.ts',import.meta.url),'utf8');
const registry=readFileSync(new URL('../supabase/drafts/kiosk-qr-credential-registry.sql',import.meta.url),'utf8');

test('QR executor cannot go live: SQL exists only in drafts; Edge Function rejects it',()=>{
 assert.match(path.pathname,/\/supabase\/drafts\//);
 assert.match(sql,/NOT A MIGRATION, NOT DEPLOYED, NOT ENABLED/);
 assert.match(edge,/parseKioskQrEnvelope\(p\)\.ok/);
 assert.match(edge,/return reply\(403,\{ok:false,error:'OPERATION_REFUSED'\}\)/);
 assert.doesNotMatch(edge,/rpc\(['"]kiosk_qr_execute['"]/);
});
test('QR adapter delegates punch updates, rate-limits and idempotence to existing PIN engine',()=>{
 assert.match(sql,/return public\.kiosk_execute\(/);
 assert.match(sql,/worker\.employee_number,p_pin,p_action,p_event,null\)/);
 assert.match(sql,/or \(p_action<>'identify' and p_event is null\)/);
 for(const table of ['punch_sessions','punch_segments','punch_breaks','kiosk_events','worker_pin_secrets'])
  assert.doesNotMatch(sql,new RegExp('(?:insert into|update|delete from)\\s+(?:public|private)\\.'+table+'\\b','i'));
});
test('only service_role can execute QR adapter, never anon or authenticated',()=>{
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/revoke all on function public\.kiosk_qr_execute\(uuid,text,text,text,text,uuid\)\s+from public,anon,authenticated;/);
 assert.match(sql,/grant execute on function public\.kiosk_qr_execute\(uuid,text,text,text,text,uuid\)\s+to service_role;/);
 assert.doesNotMatch(sql,/grant execute on function [^;]+\s+to (?:public|anon|authenticated)\s*;/);
});
test('QR adapter first locks paired device and then the worker and card before PIN',()=>{
 const device=sql.indexOf('from private.kiosk_devices where id=p_device for update');
 const firstCard=sql.indexOf('from private.kiosk_qr_cards\n  where company_id=device.company_id');
 const worker=sql.indexOf('from public.company_workers\n  where company_id=device.company_id and id=initial_card.worker_id for update');
 const card=sql.indexOf('from private.kiosk_qr_cards\n  where id=initial_card.id');
 const pin=sql.indexOf('return public.kiosk_execute(');
 assert.ok(device>=0&&firstCard>device&&worker>firstCard&&card>worker&&pin>card);
 assert.match(sql,/for share;\s*now_at:=clock_timestamp\(\);/);
});
test('QR token and employee enrollment are checked in company and against active phone binding',()=>{
 assert.match(sql,/token_hash=sha256\(convert_to\(p_card,'UTF8'\)\)/);
 assert.match(sql,/company_id=device.company_id/);
 assert.match(sql,/card\.revoked_at is not null or card\.expires_at<=now_at/);
 assert.match(sql,/card\.enrolled_user_id is distinct from worker\.auth_user_id/);
 assert.match(sql,/worker\.status<>'active' or not worker\.can_kiosk_punch/);
 assert.match(sql,/worker\.personal_access/);
 assert.match(sql,/member\.company_id=device.company_id/);
 assert.match(sql,/member\.user_id=card\.enrolled_user_id and member\.status='active'/);
 assert.match(sql,/co\.product_edition='essential'/);
 assert.match(registry,/create trigger revoke_kiosk_qr_on_membership_change/);
});
test('QR adapter cannot expose card, PIN or device token in error responses',()=>{
 const responses=[...sql.matchAll(/return jsonb_build_object\(([^;]+)\);/g)].map(x=>x[1]);
 assert.ok(responses.length>=3,'missing explicit denial responses');
 for(const result of responses){
  assert.doesNotMatch(result,/p_card|p_pin|p_token|worker\.employee_number/);
  assert.match(result,/'ok',false/);
 }
 assert.match(sql,/p_card !~ '\^P360C1\\\.\[0-9a-f\]\{64\}\$'/);
});
test('SQL adapter requires independent PIN and an idempotency event for every write',()=>{
 assert.match(sql,/p_pin is null or p_pin !~ '\^\[0-9\]\{6,12\}\$'/);
 assert.match(sql,/p_action<>'identify' and p_event is null/);
 assert.match(sql,/'identify','in','out','break_start','break_start_paid','break_end'/);
 assert.doesNotMatch(sql,/p_action='enroll'/);
});
