-- DRAFT / DISPOSABLE DATABASE ONLY; NEVER PRODUCTION.
-- Load essential kiosk migrations, kiosk-qr-credential-registry.sql and
-- kiosk-qr-execute.sql first. This test rolls back ALL synthetic records.
-- Not executed until an isolated Supabase database is authorized.
begin;
do $$
declare
 boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();
 company_a uuid;
 company_b uuid;
 worker public.company_workers;
 invitation jsonb;
 pairing_a jsonb;
 pairing_b jsonb;
 kiosk_a jsonb;
 kiosk_b jsonb;
 pin_enrollment text;
 qr_challenge text;
 qr_code text;
 result jsonb;
 ev uuid:=gen_random_uuid();
 sid uuid;
 denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@test.invalid',clock_timestamp()),
       (employee,employee||'@test.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company_a:=public.create_company_for_edition('QR Adapter Company A','essential');
 company_b:=public.create_company_for_edition('QR Adapter Company B','essential');
 update public.companies set seat_limit=5,billing_status='active'
  where id in(company_a,company_b);

 execute 'set local role authenticated';
 worker:=public.create_essential_worker(company_a,'QR-ADAPT-01','Test','Worker',employee||'@test.invalid');
 perform public.set_essential_worker_channels(worker.id,true,true,true,'Kiosk with PIN');
 pairing_a:=public.create_kiosk_pairing(company_a,'Réception A');
 pairing_b:=public.create_kiosk_pairing(company_b,'Réception B');
 pin_enrollment:=public.create_pin_enrollment(worker.id);
 invitation:=public.create_worker_invitation(worker.id);
 denied:=false;
 begin
  perform public.kiosk_qr_execute(gen_random_uuid(),'a', 'b','123456','identify');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Authenticated account executed service-only QR RPC';end if;
 execute 'reset role';

 kiosk_a:=public.kiosk_pair_device(pairing_a->>'pairing_code');
 kiosk_b:=public.kiosk_pair_device(pairing_b->>'pairing_code');
 if kiosk_a->>'ok'<>'true' or kiosk_b->>'ok'<>'true'
 then raise exception 'Kiosk pair fixture failed';end if;
 result:=public.kiosk_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token','QR-ADAPT-01',
  '829471','enroll',null,pin_enrollment);
 if result->>'ok'<>'true' then raise exception 'PIN fixture setup failed';end if;

 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 perform public.accept_worker_invitation(invitation->>'token');
 execute 'reset role';

 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 qr_challenge:=public.create_worker_qr_enrollment(worker.id);
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 qr_code:=public.activate_my_kiosk_qr_card(company_a,qr_challenge,gen_random_uuid());
 execute 'reset role';

 -- Same worker card is not valid on a different company's kiosk.
 result:=public.kiosk_qr_execute(
  (kiosk_b->>'device_id')::uuid,kiosk_b->>'token',qr_code,
  '829471','identify');
 if result->>'ok'='true' then raise exception 'Foreign company kiosk accepted QR';end if;

 -- Independent PIN required even if a screenshot/copy of QR is supplied.
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '','identify');
 if result->>'ok'='true' then raise exception 'QR alone authorized worker';end if;
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '000001','identify');
 if result->>'ok'='true' then raise exception 'Wrong PIN authorized QR';end if;

 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'<>'true' then raise exception 'Valid QR and PIN identification failed';end if;

 -- A previously paired tablet is not authorization to punch at a
 -- disabled establishment. Closing its punch job must also deny the QR.
 update public.essential_locations set active=false
  where company_id=company_a
   and punch_job_id=(select site_id from private.kiosk_devices
     where id=(kiosk_a->>'device_id')::uuid);
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'='true' then
  raise exception 'Inactive establishment accepted QR';end if;
 update public.essential_locations set active=true
  where company_id=company_a
   and punch_job_id=(select site_id from private.kiosk_devices
     where id=(kiosk_a->>'device_id')::uuid);

 update public.jobs set active=false
  where company_id=company_a
   and id=(select site_id from private.kiosk_devices
     where id=(kiosk_a->>'device_id')::uuid);
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'='true' then
  raise exception 'Inactive punch job accepted QR';end if;
 update public.jobs set active=true
  where company_id=company_a
   and id=(select site_id from private.kiosk_devices
     where id=(kiosk_a->>'device_id')::uuid);

 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'<>'true' then
  raise exception 'Reactivated establishment still denies valid QR';end if;

 -- An event is obligatory for writes. The existing kiosk ledger remains
 -- idempotent: no second session is created by replay.
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','in');
 if result->>'ok'='true' then raise exception 'QR write without event accepted';end if;
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','in',ev);
 if result->>'ok'<>'true' then raise exception 'QR IN failed: %',result;end if;
 sid:=(result->>'session_id')::uuid;
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','in',ev);
 if (result->>'session_id')::uuid is distinct from sid
 then raise exception 'QR replay duplicated event';end if;
 if (select count(*) from public.punch_sessions
  where worker_id=worker.id and company_id=company_a)<>1
 then raise exception 'QR retry created extra punch session';end if;
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','out',gen_random_uuid());
 if result->>'ok'<>'true' then raise exception 'QR OUT failed';end if;

 -- Expiration and revocation are checked with database time.
 update private.kiosk_qr_cards set expires_at=clock_timestamp()-interval '1 second'
  where token_hash=sha256(convert_to(qr_code,'UTF8'));
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'='true' then raise exception 'Expired QR accepted';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 perform public.revoke_worker_kiosk_qr_card(worker.id,'Fixture revocation');
 execute 'reset role';
 result:=public.kiosk_qr_execute(
  (kiosk_a->>'device_id')::uuid,kiosk_a->>'token',qr_code,
  '829471','identify');
 if result->>'ok'='true' then raise exception 'Revoked QR accepted';end if;
end $$;
rollback;
