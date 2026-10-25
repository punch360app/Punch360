begin;
do $$
declare boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();other uuid:=gen_random_uuid();c uuid;w uuid;j uuid;req uuid:=gen_random_uuid();cancel_req uuid:=gen_random_uuid();session uuid;denied boolean;n bigint;pauses jsonb:='[{"start":"2026-10-20T16:00:00Z","end":"2026-10-20T16:30:00Z","paid":false}]';
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@missing.test.invalid',now()),(employee,employee||'@missing.test.invalid',now()),(other,other||'@missing.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Missing day fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,employee,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=employee;select default_punch_job_id into j from public.companies where id=c;
 perform set_config('request.jwt.claim.sub',employee::text,true);execute 'set local role authenticated';
 perform public.request_essential_missing_day(req,c,w,j,'2026-10-20 12:00Z','2026-10-20 20:00Z',pauses,'Forgot entire day');
 perform public.request_essential_missing_day(req,c,w,j,'2026-10-20 12:00Z','2026-10-20 20:00Z',pauses,'Forgot entire day');
 select count(*) into n from public.punch_sessions where company_id=c;if n<>0 then raise exception 'Submission changed official hours';end if;
 denied:=false;begin perform public.review_essential_missing_day(req,true,'Self approval');exception when others then denied:=true;end;if not denied then raise exception 'Self approval permitted';end if;
 perform set_config('request.jwt.claim.sub',other::text,true);select count(*) into n from public.essential_missing_days where company_id=c;if n<>0 then raise exception 'Tenant read leak';end if;
 denied:=false;begin perform public.request_essential_missing_day(gen_random_uuid(),c,w,j,'2026-10-21 12:00Z','2026-10-21 20:00Z','[]','Wrong tenant');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Cross tenant write';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;begin perform public.set_payroll_week(c,'2026-10-19',true,'Close pending');exception when others then denied:=true;end;if not denied then raise exception 'Week closed with pending day';end if;
 session:=public.review_essential_missing_day(req,true,'Approved after checking');
 if public.review_essential_missing_day(req,true,'Approved after checking')<>session then raise exception 'Review retry changed session';end if;
 select count(*) into n from public.punch_sessions where company_id=c;if n<>1 then raise exception 'Duplicate official session';end if;
 select count(*) into n from public.punch_breaks where session_id=session and not is_paid;if n<>1 then raise exception 'Missing unpaid break';end if;
 execute 'reset role';
 select count(*) into n from public.app_notifications where company_id=c and recipient_id=employee and kind='missing_day_decision';if n<>1 then raise exception 'Missing or duplicated decision notification';end if;
 execute 'set local role authenticated';perform set_config('request.jwt.claim.sub',employee::text,true);
 denied:=false;begin perform public.request_essential_missing_day(gen_random_uuid(),c,w,j,'2026-10-20 12:00Z','2026-10-20 20:00Z','[]','Overlaps official');exception when others then denied:=true;end;if not denied then raise exception 'Overlapping day requested';end if;
 perform public.request_essential_missing_day(cancel_req,c,w,j,'2026-10-21 12:00Z','2026-10-21 20:00Z','[]','Cancel fixture');perform public.cancel_essential_missing_day(cancel_req);
 execute 'reset role';if (select status from public.essential_missing_days where id=cancel_req)<>'cancelled' then raise exception 'Cancel failed';end if;
end $$;
rollback;
