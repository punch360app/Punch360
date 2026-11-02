-- Postgres integration checks on ephemeral GitHub Actions ONLY.
-- Loads both REAL draft functions against synthetic compatibility fixtures.
-- This tests actual SQL execution, privileges, RLS boundaries and revocation,
-- but the kiosk PIN/session function is deliberately mocked in the fixture.
-- DO NOT run against a remote Supabase database or production.
\set ON_ERROR_STOP on
begin;
do $test$
declare
 boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();
 company_a uuid:=gen_random_uuid();
 company_b uuid:=gen_random_uuid();
 site_a uuid:=gen_random_uuid();
 site_b uuid:=gen_random_uuid();
 worker_id uuid:=gen_random_uuid();
 kiosk_a uuid:=gen_random_uuid();
 kiosk_b uuid:=gen_random_uuid();
 token_a text:=repeat('a',64);
 token_b text:=repeat('b',64);
 challenge text;
 card text;
 new_card text;
 result jsonb;
 replay jsonb;
 event_in uuid:=gen_random_uuid();
 event_out uuid:=gen_random_uuid();
 denied boolean:=false;
 manager_view jsonb;
begin
 insert into auth.users(id) values(boss),(employee);
 insert into public.companies(id,product_edition)
  values(company_a,'essential'),(company_b,'essential');
 insert into public.company_members(company_id,user_id,role,status)
  values(company_a,boss,'boss','active'),
        (company_a,employee,'employee','active'),
        (company_b,boss,'boss','active');
 insert into public.company_workers(
  id,company_id,auth_user_id,employee_number,status,role,
  can_kiosk_punch,personal_access)
 values(worker_id,company_a,employee,'SYNTH-001','active',
  'employee',true,true);
 insert into public.jobs(id,company_id,active)
  values(site_a,company_a,true),(site_b,company_b,true);
 insert into public.essential_locations(company_id,punch_job_id,active)
  values(company_a,site_a,true),(company_b,site_b,true);
 insert into private.kiosk_devices(
  id,company_id,site_id,token_hash,paired_at)
 values(kiosk_a,company_a,site_a,sha256(convert_to(token_a,'UTF8')),clock_timestamp()),
       (kiosk_b,company_b,site_b,sha256(convert_to(token_b,'UTF8')),clock_timestamp());

 -- The authenticated role cannot read private registry tables or run the
 -- service-only verification function, even with a guessed token.
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 begin
  perform 1 from private.kiosk_qr_cards;
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Private card table visible to authenticated';end if;
 denied:=false;
 begin
  perform public.kiosk_qr_execute(kiosk_a,token_a,
   'P360C1.'||repeat('a',64),'829471','identify');
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Service-only QR RPC executable by employee';end if;
 execute 'reset role';

 -- Admin may generate one short-lived challenge, but cannot see the card.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 challenge:=public.create_worker_qr_enrollment(worker_id);
 if challenge !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid one-time enrollment challenge';end if;
 execute 'reset role';

 -- Only the linked employee account activates the card.
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 card:=public.activate_my_kiosk_qr_card(company_a,challenge,gen_random_uuid());
 if card !~ '^P360C1\.[0-9a-f]{64}$' then
  raise exception 'Invalid canonical QR card';end if;
 result:=public.my_kiosk_qr_card_status(company_a);
 if result->>'active' is distinct from 'true' then
  raise exception 'Employee cannot see own active card status';end if;
 denied:=false;
 begin
  perform public.activate_my_kiosk_qr_card(company_a,challenge,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'One-use challenge was replayed';end if;
 execute 'reset role';

 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 manager_view:=public.list_kiosk_qr_card_status(company_a);
 if manager_view::text like '%'||card||'%' then
  raise exception 'Manager status leaked private card';end if;
 execute 'reset role';

 -- The existing PIN engine is a MOCK. This proves only that the adapter
 -- delegates PIN and event IDs rather than bypassing them.
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','identify');
 if result->>'ok' is distinct from 'true' then
  raise exception 'Valid QR with independent test PIN was rejected';end if;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'000001','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Wrong independent PIN accepted';end if;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'QR without independent PIN accepted';end if;
 result:=public.kiosk_qr_execute(kiosk_b,token_b,card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'QR accepted by another company';end if;
 result:=public.kiosk_qr_execute(kiosk_a,repeat('c',64),card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Incorrect device token accepted';end if;

 update public.essential_locations set active=false
  where company_id=company_a and punch_job_id=site_a;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Disabled establishment accepted QR';end if;
 update public.essential_locations set active=true
  where company_id=company_a and punch_job_id=site_a;

 update public.jobs set active=false where id=site_a;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Inactive punch job accepted QR';end if;
 update public.jobs set active=true where id=site_a;

 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','in');
 if result->>'ok' is distinct from 'false' then
  raise exception 'QR event write without eventId accepted';end if;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','in',event_in);
 if result->>'ok' is distinct from 'true' then
  raise exception 'QR event with valid id rejected';end if;
 replay:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','in',event_in);
 if replay is distinct from result then
  raise exception 'QR event replay returned different receipt';end if;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','out',event_out);
 if result->>'ok' is distinct from 'true' then
  raise exception 'QR OUT rejected';end if;
 if (select count(*) from private.isolated_kiosk_receipts)<>2 then
  raise exception 'Mock receipt idempotence did not retain exactly two events';end if;

 -- Rotation revokes the older card immediately.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 challenge:=public.create_worker_qr_enrollment(worker_id);
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 execute 'set local role authenticated';
 new_card:=public.activate_my_kiosk_qr_card(company_a,challenge,gen_random_uuid());
 execute 'reset role';
 result:=public.kiosk_qr_execute(kiosk_a,token_a,card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Rotated previous QR remained valid';end if;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,new_card,'829471','identify');
 if result->>'ok' is distinct from 'true' then
  raise exception 'Newly rotated QR rejected';end if;

 -- Membership suspension fires revocation trigger in the same transaction.
 update public.company_members set status='suspended'
  where company_id=company_a and user_id=employee;
 result:=public.kiosk_qr_execute(kiosk_a,token_a,new_card,'829471','identify');
 if result->>'ok' is distinct from 'false' then
  raise exception 'Suspended member QR remained valid';end if;
 if exists(select 1 from private.kiosk_qr_cards q
   join public.company_workers w on w.id=q.worker_id
   where w.auth_user_id=employee and q.revoked_at is null) then
  raise exception 'Membership trigger did not revoke active QR';end if;
 raise notice 'PASS: isolated QR registry, grants, native SQL validation, company/site gates, PIN delegation mock, event replay, rotation, suspension';
end $test$;
rollback;
