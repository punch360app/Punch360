-- NAV-007: synthetic A/B companies, no live customer data, BEGIN/ROLLBACK.
begin;
do $$
declare boss_a uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 worker_a_user uuid:=gen_random_uuid();worker_b_user uuid:=gen_random_uuid();
 company_a uuid;company_b uuid;location_a uuid;worker_a uuid;worker_b uuid;
 shift_id uuid;shift_version integer;report_id uuid;second_id uuid;
 details jsonb;response jsonb;notices bigint;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss_a,boss_a||'@nav007.test.invalid',now()),
 (boss_b,boss_b||'@nav007.test.invalid',now()),
 (worker_a_user,worker_a_user||'@nav007.test.invalid',now()),
 (worker_b_user,worker_b_user||'@nav007.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 company_a:=public.create_company_for_edition('Arrival synthetic A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 company_b:=public.create_company_for_edition('Arrival synthetic B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(company_a,company_b);
 insert into public.company_members(company_id,user_id,role,status) values
 (company_a,worker_a_user,'employee','active'),(company_b,worker_b_user,'employee','active'),
 (company_a,boss_a,'boss','active'),(company_b,boss_b,'boss','active')
 on conflict (company_id,user_id) do update set role=excluded.role,status=excluded.status;
 select id into location_a from public.essential_locations where company_id=company_a limit 1;
 select id into worker_a from public.company_workers where company_id=company_a and auth_user_id=worker_a_user;
 select id into worker_b from public.company_workers where company_id=company_b and auth_user_id=worker_b_user;
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 shift_id:=public.save_essential_shift(company_a,worker_a,location_a,null,
   clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 8 hours');
 select version into shift_version from public.scheduled_shifts where id=shift_id;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',worker_a_user::text,true);
 response:=public.report_essential_shift_arrival_issue(shift_id,shift_version,'late',
  'Arrêt de circulation imprévu',25,gen_random_uuid());
 if response->>'duplicate'<>'false' then raise exception 'Initial late issue not created: %',response;end if;
 report_id:=(response->>'id')::uuid;
 -- Another request for same shift/kind must not alert twice.
 response:=public.report_essential_shift_arrival_issue(shift_id,shift_version,'late',
  'Une deuxième note ne doit pas déclencher de nouvel avis',40,gen_random_uuid());
 if (response->>'id')::uuid<>report_id or response->>'duplicate'<>'true' then
  raise exception 'Duplicate report did not return existing issue: %',response;end if;
 response:=public.report_essential_shift_arrival_issue(shift_id,shift_version,'access',
  'Portail verrouillé, besoin d’une instruction du responsable',null,gen_random_uuid());
 second_id:=(response->>'id')::uuid;
 if second_id=report_id then raise exception 'Independent access issue not supported';end if;
 details:=public.list_essential_shift_arrival_issues(company_a);
 if jsonb_array_length(details->'items')<>2 then raise exception 'Own two reports not visible: %',details;end if;
 if not exists(select 1 from jsonb_array_elements(details->'items') x
   where x->>'kind'='late' and x->>'private_message'='Arrêt de circulation imprévu')
 then raise exception 'Own report message wrong';end if;
 denied:=false;begin
  perform public.ack_essential_shift_arrival_issue(company_a,report_id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Worker acknowledged own issue';end if;
 denied:=false;perform set_config('request.jwt.claim.sub',worker_b_user::text,true);
 begin perform public.list_essential_shift_arrival_issues(company_a);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company worker read issues';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.ack_essential_shift_arrival_issue(company_a,report_id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company boss acknowledged';end if;
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 details:=public.list_essential_shift_arrival_issues(company_a);
 if jsonb_array_length(details->'items')<>2 then raise exception 'Manager cannot read reports';end if;
 response:=public.ack_essential_shift_arrival_issue(company_a,report_id);
 if response->>'duplicate'<>'false' or response->>'status'<>'acknowledged' then
   raise exception 'Acknowledgement failed: %',response;end if;
 response:=public.ack_essential_shift_arrival_issue(company_a,report_id);
 if response->>'duplicate'<>'true' then raise exception 'Repeated acknowledgement not idempotent';end if;
 perform set_config('request.jwt.claim.sub',worker_a_user::text,true);
 details:=public.list_essential_shift_arrival_issues(company_a);
 if (select x->>'status' from jsonb_array_elements(details->'items') x
   where x->>'id'=report_id::text)<>'acknowledged' then raise exception 'Employee not seeing acknowledgement';end if;
 denied:=false;begin
  perform public.report_essential_shift_arrival_issue(shift_id,shift_version,'late','Private',null,null);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Null request accepted';end if;
 denied:=false;begin
  perform public.report_essential_shift_arrival_issue(shift_id,shift_version,'access','Private',2,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'ETA sent with access issue';end if;
 execute 'reset role';
 select count(*) into notices from public.app_notifications where company_id=company_a and kind='shift_arrival_issue';
 if notices<>2 then raise exception 'Expected two manager notifications not duplicates, got %',notices;end if;
 select count(*) into notices from public.app_notifications where company_id=company_a and kind='shift_arrival_ack';
 if notices<>1 then raise exception 'Expected one employee acknowledgement, got %',notices;end if;
 if exists(select 1 from public.app_notifications where company_id=company_a and
   (body ilike '%Arrêt de circulation%' or body ilike '%portail%' or body ilike '%verrouillé%'))
 then raise exception 'Private free text leaked in notification';end if;
 if has_table_privilege('authenticated','private.essential_shift_arrival_issues','select')
 or has_function_privilege('anon','public.report_essential_shift_arrival_issue(uuid,integer,text,text,integer,uuid)','execute')
 then raise exception 'Private reports or public RPC accidentally exposed';end if;
 if (select count(*) from public.punch_sessions where company_id=company_a)<>0 then
  raise exception 'Arrival report created punch session';end if;
end $$;
rollback;
