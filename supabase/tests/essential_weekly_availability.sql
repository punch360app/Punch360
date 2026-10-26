-- Synthetic tenant, worker and shift proof. All changes rolled back.
begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();owner_id uuid;sid uuid:=gen_random_uuid();
 tenant uuid;other_tenant uuid;site uuid;worker uuid;no_phone_worker uuid;shift_id uuid;
 req uuid:=gen_random_uuid();result jsonb;view_rows jsonb;preview jsonb;exception_id uuid;
 shift_row public.scheduled_shifts;rule_id uuid;leave_id uuid;changed boolean;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@test.invalid',now()),(other_boss,other_boss||'@test.invalid',now()),
 (employee,employee||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 tenant:=public.create_company_for_edition('Weekly fixture A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 other_tenant:=public.create_company_for_edition('Weekly fixture B','essential');
 update public.companies set billing_status='active',is_test=true,billing_mode='test_simulated',seat_limit=20 where id in(tenant,other_tenant);
 insert into public.company_members(company_id,user_id,role,status)
 values(tenant,employee,'employee','active');
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 perform public.platform_set_essential_test_plan(tenant,'essential_plus');
 perform public.platform_set_essential_test_plan(other_tenant,'essential_plus');
 execute 'reset role';
 select id into site from public.essential_locations where company_id=tenant and active limit 1;
 select id into worker from public.company_workers where company_id=tenant and auth_user_id=employee;
 if site is null or worker is null then raise exception 'Test company employee missing';end if;
 insert into public.company_workers(company_id,employee_number,first_name,last_name,location_id,personal_access)
 values(tenant,'NO-PHONE-1','No','Phone',site,false) returning id into no_phone_worker;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 shift_id:=public.save_essential_shift(tenant,worker,site,null,
  ((current_date+10)::timestamp+interval '10 hours') at time zone 'America/Toronto',
  ((current_date+10)::timestamp+interval '18 hours') at time zone 'America/Toronto');
 select * into shift_row from public.scheduled_shifts where id=shift_id;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 result:=public.save_essential_weekly_availability(tenant,worker,site,ARRAY[1,2,3,4,5,6,7],
  '09:00','19:00',current_date,null,true,req);
 if result->>'duplicate'<>'false' then raise exception 'New rule missing';end if;
 rule_id:=(result->>'id')::uuid;
 result:=public.save_essential_weekly_availability(tenant,worker,site,ARRAY[1,2,3,4,5,6,7],
  '09:00','19:00',current_date,null,true,req);
 if result->>'duplicate'<>'true' or (result->>'id')::uuid<>rule_id then raise exception 'Retry created duplicate';end if;
 denied:=false;begin
  perform public.save_essential_weekly_availability(tenant,no_phone_worker,site,ARRAY[1],'09:00','19:00',current_date,null,true,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee modified colleague';end if;
 view_rows:=public.list_essential_weekly_availability(tenant);
 if jsonb_array_length(view_rows)<>1 or view_rows->0->>'worker_id'<>worker::text then raise exception 'Employee list incorrect';end if;
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'available' then raise exception 'Weekly availability not shown: %',preview;end if;
 -- Approved leave outranks a recurring available rule; no salary or shift mutations.
 execute 'reset role';
 insert into public.leave_requests(company_id,user_id,leave_type,begins_on,ends_on,status)
 values(tenant,employee,'personal',(shift_row.starts_at at time zone 'America/Toronto')::date,
 (shift_row.ends_at at time zone 'America/Toronto')::date,'approved') returning id into leave_id;
 execute 'set local role authenticated';
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'unavailable' or preview->'shifts'->0->>'source'<>'approved_leave' then
  raise exception 'Approved leave did not outrank recurring: %',preview;end if;
 execute 'reset role';
 update public.leave_requests set status='cancelled' where id=leave_id;
 execute 'set local role authenticated';
 -- An explicitly reported absence is also higher priority.
 perform public.report_essential_shift_absence(shift_id,shift_row.version,'undisclosed','',gen_random_uuid());
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'unavailable' or preview->'shifts'->0->>'source'<>'absence' then
  raise exception 'Reported absence did not outrank recurring: %',preview;end if;
 execute 'reset role';
 delete from private.essential_shift_absences where company_id=tenant and shift_id=shift_id;
 execute 'set local role authenticated';
 exception_id:=public.set_essential_availability(tenant,shift_row.starts_at,shift_row.ends_at,false,'');
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'unavailable' or preview->'shifts'->0->>'source'<>'dated_exception' then
  raise exception 'Dated unavailability did not override weekly: %',preview;end if;
 perform public.remove_essential_availability(exception_id);
 changed:=public.remove_essential_weekly_availability(rule_id,1);
 if not changed then raise exception 'Archive rule failed';end if;
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'unknown' then raise exception 'No rule must mean unknown';end if;
 -- An explicit unavailable window reports a conflict but never rewrites the assignment.
 result:=public.save_essential_weekly_availability(tenant,worker,site,ARRAY[1,2,3,4,5,6,7],
  '09:00','19:00',current_date,null,false,gen_random_uuid());
 if (result->>'conflicts')::int<1 then raise exception 'Published shift conflict not counted';end if;
 preview:=public.essential_availability_shift_preview(tenant,shift_row.starts_at-interval '1 day',shift_row.ends_at+interval '1 day');
 if preview->'shifts'->0->>'status'<>'unavailable' then raise exception 'Weekly unavailable missing';end if;
 if (select version from public.scheduled_shifts where id=shift_id)<>shift_row.version or
    (select worker_id from public.scheduled_shifts where id=shift_id) is distinct from worker then
  raise exception 'Rule incorrectly edited published shift';
 end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;begin perform public.list_essential_weekly_availability(tenant);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-tenant access permitted';end if;
 denied:=false;begin perform public.save_essential_weekly_availability(tenant,worker,site,ARRAY[1],'06:00','07:00',current_date,null,true,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-tenant edit permitted';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_weekly_availability(tenant,no_phone_worker,site,ARRAY[1,3,5],
  '07:00','15:00',current_date,null,true,gen_random_uuid());
 if result->>'duplicate'<>'false' then raise exception 'Manager could not create no-phone rule';end if;
 view_rows:=public.list_essential_weekly_availability(tenant);
 if jsonb_array_length(view_rows)<>2 then raise exception 'Manager cannot see delegated rules';end if;
 execute 'reset role';
 if has_table_privilege('authenticated','public.essential_weekly_availability','select')
 then raise exception 'Direct table access wrongly granted';end if;
 if has_function_privilege('anon','public.save_essential_weekly_availability(uuid,uuid,uuid,integer[],time without time zone,time without time zone,date,date,boolean,uuid)','execute')
 then raise exception 'Anonymous RPC privilege wrongly granted';end if;
end $$;
rollback;
