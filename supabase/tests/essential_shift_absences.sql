-- Run against an isolated database or in a single rolled-back transaction.
-- Two fictitious companies; no customer time, salaries, invoices or contracts changed.
begin;
do $$
declare
  sid uuid:=gen_random_uuid();
  boss_a uuid:=gen_random_uuid(); boss_b uuid:=gen_random_uuid();
  employee_a uuid:=gen_random_uuid(); employee_b uuid:=gen_random_uuid();
  owner_id uuid; tenant_a uuid; tenant_b uuid; site_a uuid;
  worker_a uuid; worker_b uuid; shift_a uuid; expected_version integer;
  submission_id uuid:=gen_random_uuid(); result jsonb; items jsonb; report_id uuid;
  denied boolean; manager_notices bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss_a,boss_a||'@test.invalid',now()),(boss_b,boss_b||'@test.invalid',now()),
  (employee_a,employee_a||'@test.invalid',now()),(employee_b,employee_b||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 tenant_a:=public.create_company_for_edition('Absence synthetic A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 tenant_b:=public.create_company_for_edition('Absence synthetic B','essential');
 update public.companies set billing_status='active',is_test=true,billing_mode='test_simulated',seat_limit=20
 where id in (tenant_a,tenant_b);
 insert into public.company_members(company_id,user_id,role) values
  (tenant_a,employee_a,'employee'),(tenant_b,employee_b,'employee');
 -- Ensure the synthetic company managers are active, independently of onboarding defaults.
 insert into public.company_members(company_id,user_id,role,status) values
 (tenant_a,boss_a,'boss','active'),(tenant_b,boss_b,'boss','active')
 on conflict(company_id,user_id) do update set role='boss',status='active';
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after)
 values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 perform public.platform_set_essential_test_plan(tenant_a,'essential_plus');
 perform public.platform_set_essential_test_plan(tenant_b,'essential_plus');
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 select id into site_a from public.essential_locations where company_id=tenant_a limit 1;
 select id into worker_a from public.company_workers where company_id=tenant_a and auth_user_id=employee_a;
 select id into worker_b from public.company_workers where company_id=tenant_b and auth_user_id=employee_b;
 if site_a is null or worker_a is null or worker_b is null then raise exception 'Missing synthetic staff';end if;
 shift_a:=public.save_essential_shift(tenant_a,worker_a,site_a,null,
         clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days 8 hours');
 select version into expected_version from public.scheduled_shifts where id=shift_a;
 if has_table_privilege('authenticated','private.essential_shift_absences','select') then
   raise exception 'Private reports exposed directly';
 end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',employee_b::text,true);
 denied:=false;
 begin
  perform public.report_essential_shift_absence(shift_a,expected_version,'undisclosed','',gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company reported absence';end if;
 denied:=false;
 begin
  perform public.list_essential_shift_absences(tenant_a);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-tenant list visible';end if;
 perform set_config('request.jwt.claim.sub',employee_a::text,true);
 denied:=false;
 begin
  perform public.report_essential_shift_absence(shift_a,expected_version,'invalid','',gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Unknown category accepted';end if;
 result:=public.report_essential_shift_absence(shift_a,expected_version,'personal','private note',submission_id);
 if result->>'status'<>'reported' or result->>'duplicate'<>'false' then raise exception 'Report not created';end if;
 report_id:=(result->>'id')::uuid;
 result:=public.report_essential_shift_absence(shift_a,expected_version,'personal','private note',submission_id);
 if result->>'duplicate'<>'true' then raise exception 'Replay not idempotent';end if;
 items:=public.list_essential_shift_absences(tenant_a);
 if jsonb_array_length(items)<>1 or items::text like '%private note%' or items::text like '%reason_code%' then
   raise exception 'Private data leaked or report unavailable';
 end if;
 select count(*) into manager_notices from public.app_notifications where company_id=tenant_a and kind='shift_absence';
 if manager_notices<>1 then raise exception 'Unexpected manager notifications: %',manager_notices;end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;
 begin
  perform public.review_essential_shift_absence(report_id,'acknowledged');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other tenant reviewed report';end if;
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 result:=public.review_essential_shift_absence(report_id,'follow_up');
 if result->>'status'<>'follow_up' then raise exception 'Manager response missing';end if;
 result:=public.review_essential_shift_absence(report_id,'follow_up');
 if result->>'duplicate'<>'true' then raise exception 'Repeat manager action not idempotent';end if;
 perform set_config('request.jwt.claim.sub',employee_a::text,true);
 items:=public.list_essential_shift_absences(tenant_a);
 if items->0->>'status'<>'follow_up' then raise exception 'Employee cannot see response';end if;
 if (select worker_id from public.scheduled_shifts where id=shift_a) is distinct from worker_a or
    (select version from public.scheduled_shifts where id=shift_a)<>expected_version then
  raise exception 'Absence incorrectly modified official shift';
 end if;
 execute 'reset role';
 if (select count(*) from private.essential_shift_absences where company_id=tenant_a)<>1 then
  raise exception 'Duplicated absence';
 end if;
end $$;
rollback;
