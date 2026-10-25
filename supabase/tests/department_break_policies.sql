begin;
do $$
declare boss uuid:=gen_random_uuid();u uuid:=gen_random_uuid();other uuid:=gen_random_uuid();c uuid;l uuid;dep uuid;w uuid;s uuid;p uuid;result jsonb;denied boolean;started timestamptz;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@breakpolicy.test.invalid',now()),(u,u||'@breakpolicy.test.invalid',now()),(other,other||'@breakpolicy.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Break policy fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(x) from public.essential_plans x where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,u,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=u;select id into l from public.essential_locations where company_id=c;
 execute 'set local role authenticated';dep:=public.save_essential_department(c,l,'Production');perform public.assign_essential_worker(w,l,dep);p:=public.save_department_break_policy(c,dep,0,'paid',15,120,'Fixture paid rule');
 denied:=false;begin perform public.save_department_break_policy(c,dep,0,'unpaid',30,240,'Stale policy edit');exception when others then denied:=true;end;if not denied then raise exception 'Stale rule overwritten';end if;
 execute 'reset role';insert into public.punch_sessions(company_id,worker_id,user_id,started_at) values(c,w,u,clock_timestamp()-interval '1 hour') returning id into s;
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';result:=public.essential_worker_break_policy(c,w);if result->>'paid_mode'<>'paid' then raise exception 'Own rule missing';end if;
 denied:=false;begin perform public.save_department_break_policy(c,dep,1,'choice',null,null,'Employee escalation');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Employee changed policy';end if;
 result:=public.sync_break_event(gen_random_uuid(),c,'break_start',clock_timestamp(),false);if result->>'sync_status'<>'conflict' then raise exception 'Unpaid start bypassed paid policy';end if;
 result:=public.sync_paid_break_start(gen_random_uuid(),c,clock_timestamp(),false);if result->>'sync_status'<>'synced' then raise exception 'Legitimate paid break blocked';end if;
 execute 'reset role';if not exists(select 1 from public.punch_breaks where session_id=s and is_paid and policy_snapshot->>'id'=p::text) then raise exception 'Paid classification or rule snapshot lost';end if;
 if exists(select 1 from private.essential_paid_break_context) then raise exception 'Temporary context leaked';end if;
 select started_at into started from public.punch_breaks where session_id=s;
 perform set_config('request.jwt.claim.sub',other::text,true);execute 'set local role authenticated';denied:=false;begin perform public.essential_worker_break_policy(c,w);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Foreign policy/worker accessed';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.save_department_break_policy(c,dep,1,'unpaid',30,240,'Future paid classification');execute 'reset role';
 if not exists(select 1 from public.punch_breaks where session_id=s and is_paid and started_at=started and policy_snapshot->>'id'=p::text) then raise exception 'Policy update rewrote history';end if;
end $$;
rollback;
