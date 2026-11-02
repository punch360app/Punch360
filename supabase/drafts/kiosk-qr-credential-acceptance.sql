-- Transactional acceptance test for the QR credential REGISTRY DRAFT ONLY.
-- Never run on production. In a disposable Supabase test database:
--   1. Load migrations including essential_kiosk_ledger.
--   2. Load supabase/drafts/kiosk-qr-credential-registry.sql manually.
--   3. Run this script (BEGIN/ROLLBACK). This is not part of deploy migrations.
-- No QR-to-punch RPC exists. These tests verify only issuance and revocation.
begin;

do $$
declare
 boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();
 company_a uuid;
 company_b uuid;
 worker public.company_workers;
 invitation jsonb;
 enrollment text;
 card_one text;
 card_two text;
 denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@test.invalid',clock_timestamp()),
       (employee,employee||'@test.invalid',clock_timestamp());

 perform set_config('request.jwt.claim.sub',boss::text,true);
 company_a:=public.create_company_for_edition('QR registry test A','essential');
 company_b:=public.create_company_for_edition('QR registry test B','essential');
 update public.companies set billing_status='active',seat_limit=5
  where id in(company_a,company_b);

 execute 'set local role authenticated';
 worker:=public.create_essential_worker(
  company_a,'QR-001','Fixture','Worker',employee||'@test.invalid');
 perform public.set_essential_worker_channels(
  worker.id,true,true,true,'Allow tablet with independent PIN');
 invitation:=public.create_worker_invitation(worker.id);
 execute 'reset role';

 -- Personal Auth must be activated and associated with the existing worker.
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 perform public.accept_worker_invitation(invitation->>'token');
 denied:=false;
 begin
  perform public.create_worker_qr_enrollment(worker.id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee issued manager-only challenge';end if;
 execute 'reset role';

 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 enrollment:=public.create_worker_qr_enrollment(worker.id);
 if enrollment !~ '^[0-9a-f]{64}$' then raise exception 'Not an opaque challenge';end if;
 execute 'reset role';

 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 denied:=false;
 begin
  perform public.activate_my_kiosk_qr_card(company_b,enrollment,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign-company activation succeeded';end if;

 card_one:=public.activate_my_kiosk_qr_card(company_a,enrollment,gen_random_uuid());
 if card_one !~ '^P360C1\.[0-9a-f]{64}$' then
  raise exception 'Card format is invalid';
 end if;
 denied:=false;
 begin
  perform public.activate_my_kiosk_qr_card(company_a,enrollment,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Enrollment replay succeeded';end if;
 execute 'reset role';

 if not exists(
  select 1 from private.kiosk_qr_cards
  where company_id=company_a and worker_id=worker.id
   and enrolled_user_id=employee and revoked_at is null
   and token_hash=sha256(convert_to(card_one,'UTF8'))
 ) then raise exception 'Only hashed active credential must be stored';end if;
 if (select count(*) from private.kiosk_qr_cards
  where company_id=company_a and worker_id=worker.id and revoked_at is null)<>1
 then raise exception 'Multiple active cards issued';end if;

 -- Activating a new card atomically revokes the previous card.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 enrollment:=public.create_worker_qr_enrollment(worker.id);
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 card_two:=public.activate_my_kiosk_qr_card(company_a,enrollment,gen_random_uuid());
 execute 'reset role';

 if card_one=card_two then raise exception 'Card rotation reused old secret';end if;
 if exists(select 1 from private.kiosk_qr_cards
    where token_hash=sha256(convert_to(card_one,'UTF8')) and revoked_at is null)
 then raise exception 'Old card not revoked on rotation';end if;
 if (select count(*) from private.kiosk_qr_cards
    where company_id=company_a and worker_id=worker.id and revoked_at is null)<>1
 then raise exception 'Rotation retained multiple active cards';end if;

 -- Employee can revoke their own card without accessing another company.
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 perform public.revoke_my_kiosk_qr_card(company_a);
 denied:=false;
 begin
  perform public.revoke_my_kiosk_qr_card(company_b);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign-company self revoke accepted';end if;
 execute 'reset role';
 if exists(select 1 from private.kiosk_qr_cards
   where company_id=company_a and worker_id=worker.id and revoked_at is null)
 then raise exception 'Self revocation left an active card';end if;

 -- Removing company membership must invalidate a live card even if
 -- the worker record has not yet been synchronized by another trigger.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 enrollment:=public.create_worker_qr_enrollment(worker.id);
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 card_two:=public.activate_my_kiosk_qr_card(company_a,enrollment,gen_random_uuid());
 execute 'reset role';
 if not exists(select 1 from private.kiosk_qr_cards
  where company_id=company_a and worker_id=worker.id
   and token_hash=sha256(convert_to(card_two,'UTF8')) and revoked_at is null)
 then raise exception 'Membership test setup did not issue card';end if;
 update public.company_members set status='disabled'
  where company_id=company_a and user_id=employee;
 if exists(select 1 from private.kiosk_qr_cards
   where company_id=company_a and worker_id=worker.id and revoked_at is null)
 then raise exception 'Disabled company membership kept QR active';end if;
 update public.company_members set status='active'
  where company_id=company_a and user_id=employee;
 if exists(select 1 from private.kiosk_qr_cards
   where company_id=company_a and worker_id=worker.id and revoked_at is null)
 then raise exception 'Reactivation silently restored an old QR';end if;

 -- Fresh enrollment becomes invalid on staff deactivation in the same tx.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 enrollment:=public.create_worker_qr_enrollment(worker.id);
 execute 'reset role';
 update public.company_workers set status='disabled' where id=worker.id;
 if exists(select 1 from private.kiosk_qr_enrollments
   where company_id=company_a and worker_id=worker.id
    and consumed_at is null and revoked_at is null)
 then raise exception 'Disabled worker kept unconsumed challenge';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 denied:=false;
 begin
  perform public.activate_my_kiosk_qr_card(company_a,enrollment,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Disabled worker activated a card';end if;
 execute 'reset role';

 -- A revoked worker's card cannot be restored via a stale challenge.
 if exists(select 1 from private.kiosk_qr_cards
   where company_id=company_a and worker_id=worker.id and revoked_at is null)
 then raise exception 'Disabled worker has an active card';end if;
end $$;
rollback;
