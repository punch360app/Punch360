begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();
 owner_id uuid;sid uuid:=gen_random_uuid();company uuid;foreign_company uuid;w uuid;no_phone uuid;
 req uuid:=gen_random_uuid();ret jsonb;rows jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@test.invalid',now()),(other_boss,other_boss||'@test.invalid',now()),(employee,employee||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Schedule prefs A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 foreign_company:=public.create_company_for_edition('Schedule prefs B','essential');
 update public.companies set billing_status='active',is_test=true,billing_mode='test_simulated',seat_limit=20 where id in(company,foreign_company);
 insert into public.company_members(company_id,user_id,role,status) values(company,employee,'employee','active');
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 perform public.platform_set_essential_test_plan(company,'essential_plus');
 perform public.platform_set_essential_test_plan(foreign_company,'essential_plus');
 execute 'reset role';
 select id into w from public.company_workers where company_id=company and auth_user_id=employee;
 insert into public.company_workers(company_id,employee_number,first_name,last_name,personal_access)
 values(company,'NO-PHONE','Sans','Compte',false) returning id into no_phone;
 if w is null then raise exception 'Fixture employee missing';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 ret:=public.save_essential_worker_schedule_preferences(company,w,35,ARRAY['day','evening'],'flexible',true,false,5,0,req);
 if ret->>'duplicate'<>'false' or (ret->>'version')::int<>1 then raise exception 'Employee preferences not saved';end if;
 ret:=public.save_essential_worker_schedule_preferences(company,w,35,ARRAY['day','evening'],'flexible',true,false,5,0,req);
 if ret->>'duplicate'<>'true' then raise exception 'Idempotent retry made another version';end if;
 denied:=false;
 begin perform public.set_essential_worker_schedule_constraints(company,w,'2020-01-01',30,40,1);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee edited contractual hours';end if;
 denied:=false;
 begin perform public.save_essential_worker_schedule_preferences(company,no_phone,30,ARRAY['day'],'avoid',false,false,null,0,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee edited no-phone coworker';end if;
 rows:=public.list_essential_worker_schedule_preferences(company);
 if jsonb_array_length(rows)<>1 or (rows->0->>'worker_id')<>w::text or (rows->0->>'desired_weekly_hours')::numeric<>35
 then raise exception 'Own preferences list incorrect: %',rows;end if;
 denied:=false;begin
  perform public.save_essential_worker_schedule_preferences(company,w,33,ARRAY['night'],'prefer',false,false,null,0,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale version overwrite allowed';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 ret:=public.set_essential_worker_schedule_constraints(company,w,'2021-06-01',25,40,1);
 if (ret->>'version')::int<>2 then raise exception 'Manager constraints not versioned';end if;
 ret:=public.save_essential_worker_schedule_preferences(company,no_phone,28,ARRAY['day'],'avoid',true,true,4,0,gen_random_uuid());
 if (ret->>'version')::int<>1 then raise exception 'Manager delegated wishes not saved';end if;
 rows:=public.list_essential_worker_schedule_preferences(company);
 if not exists(select 1 from jsonb_array_elements(rows) x where x->>'worker_id'=w::text) or not exists(select 1 from jsonb_array_elements(rows) x where x->>'worker_id'=no_phone::text) then raise exception 'Manager list missed staff';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;begin perform public.list_essential_worker_schedule_preferences(company);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company list exposed';end if;
 denied:=false;begin
 perform public.save_essential_worker_schedule_preferences(company,w,20,ARRAY['night'],'flexible',false,false,null,2,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company write exposed';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 ret:=public.save_essential_worker_schedule_preferences(company,w,37,ARRAY['night'],'prefer',false,false,null,2,gen_random_uuid());
 if (ret->>'version')::int<>3 then raise exception 'Employee update with fresh version failed';end if;
 execute 'reset role';
 if (select seniority_from from public.essential_worker_schedule_preferences where company_id=company and worker_id=w)<>'2021-06-01' then
 raise exception 'Employee update overwrote company HR information';end if;
 if has_table_privilege('authenticated','public.essential_worker_schedule_preferences','select')
 then raise exception 'Direct read privilege must be denied';end if;
 if has_function_privilege('anon','public.list_essential_worker_schedule_preferences(uuid)','execute')
 then raise exception 'Anonymous read RPC must be denied';end if;
 if (select count(*) from public.workforce_audit where company_id=company and action in
   ('worker_schedule_preferences_saved','worker_schedule_constraints_saved'))<>4
 then raise exception 'Incorrect audit action count';end if;
end $$;
rollback;
