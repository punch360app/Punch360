begin;
do $$
declare boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();c uuid;w uuid;j uuid;req uuid:=gen_random_uuid();s uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@missing.test.invalid',now()),(employee,employee||'@missing.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Missing conflict fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,employee,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=employee;select default_punch_job_id into j from public.companies where id=c;
 perform set_config('request.jwt.claim.sub',employee::text,true);execute 'set local role authenticated';
 denied:=false;begin perform public.request_essential_missing_day(gen_random_uuid(),c,w,j,'2026-10-20 12:00Z','2026-10-20 20:00Z','[{"start":"2026-10-20T11:00Z","end":"2026-10-20T12:30Z","paid":false}]','Invalid break');exception when others then denied:=true;end;if not denied then raise exception 'Out of bounds break accepted';end if;
 perform public.request_essential_missing_day(req,c,w,j,'2026-10-20 12:00Z','2026-10-20 20:00Z','[]','Forgot all punches');
 execute 'reset role';insert into public.punch_sessions(company_id,worker_id,user_id,started_at,ended_at) values(c,w,employee,'2026-10-20 13:00Z','2026-10-20 14:00Z') returning id into s;
 perform set_config('request.jwt.claim.sub',boss::text,true);execute 'set local role authenticated';denied:=false;begin perform public.review_essential_missing_day(req,true,'Approval after new punch');exception when others then denied:=true;end;if not denied then raise exception 'Concurrent punch overwritten';end if;
 perform public.review_essential_missing_day(req,false,'Existing official punch takes precedence');
 execute 'reset role';if (select count(*) from public.punch_sessions where company_id=c)<>1 or (select status from public.essential_missing_days where id=req)<>'rejected' then raise exception 'Rejection changed time';end if;
end $$;
rollback;
