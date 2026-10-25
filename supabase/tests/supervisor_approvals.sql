begin;
do $$
declare boss uuid:=gen_random_uuid();sup uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid;l uuid;da uuid;db uuid;wa uuid;wb uuid;sa uuid:=gen_random_uuid();sb uuid:=gen_random_uuid();ra uuid:=gen_random_uuid();rb uuid:=gen_random_uuid();leave_id uuid:=gen_random_uuid();v integer;inbox jsonb;denied boolean;n bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@scope.test.invalid',now()),(sup,sup||'@scope.test.invalid',now()),(a,a||'@scope.test.invalid',now()),(b,b||'@scope.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Supervisor approval fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(p) from public.essential_plans p where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,sup,'employee'),(c,a,'employee'),(c,b,'employee');select id into l from public.essential_locations where company_id=c;
 da:=public.save_essential_department(c,l,'Team A');db:=public.save_essential_department(c,l,'Team B');select id into wa from public.company_workers where company_id=c and auth_user_id=a;select id into wb from public.company_workers where company_id=c and auth_user_id=b;perform public.assign_essential_worker(wa,l,da);perform public.assign_essential_worker(wb,l,db);perform public.set_essential_supervisor(c,da,sup,false);
 insert into public.punch_sessions(id,company_id,worker_id,user_id,started_at,ended_at) values(sa,c,wa,a,'2026-10-20 12:00Z','2026-10-20 20:00Z'),(sb,c,wb,b,'2026-10-20 12:00Z','2026-10-20 20:00Z');
 insert into public.punch_segments(company_id,session_id,job_id,started_at,ended_at) select c,x,default_punch_job_id,'2026-10-20 12:00Z','2026-10-20 20:00Z' from public.companies,unnest(array[sa,sb]) x where id=c;
 insert into public.punch_correction_requests(id,company_id,session_id,requested_by,requested_start,reason) values(ra,c,sa,a,'2026-10-20 12:30Z','Team A correction'),(rb,c,sb,b,'2026-10-20 12:30Z','Team B correction');
 insert into public.leave_requests(id,company_id,user_id,leave_type,begins_on,ends_on,reason) values(leave_id,c,a,'personal','2026-11-02','2026-11-02','Team A leave');
 perform set_config('request.jwt.claim.sub',sup::text,true);execute 'set local role authenticated';inbox:=public.supervisor_approval_inbox(c);if jsonb_array_length(inbox)<>0 then raise exception 'Read-only scope gained approval';end if;
 denied:=false;begin perform public.review_punch_correction(ra,true,'No approval flag');exception when others then denied:=true;end;if not denied then raise exception 'Missing time permission bypassed';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',boss::text,true);v:=public.set_supervisor_approvals(c,da,sup,true,false,1,'Delegate time only');
 perform set_config('request.jwt.claim.sub',sup::text,true);execute 'set local role authenticated';inbox:=public.supervisor_approval_inbox(c);if jsonb_array_length(inbox)<>1 or inbox->0->>'id'<>ra::text then raise exception 'Department or permission leak';end if;
 select count(*) into n from public.company_workers where id=wa;if n<>0 then raise exception 'Private worker row exposed';end if;
 denied:=false;begin perform public.review_punch_correction(rb,true,'Other department');exception when others then denied:=true;end;if not denied then raise exception 'Other department approved';end if;
 denied:=false;begin perform public.review_leave(leave_id,true,'Time flag is not leave');exception when others then denied:=true;end;if not denied then raise exception 'Time permission gained leave';end if;
 perform public.review_punch_correction(ra,true,'Scoped time approval');
 execute 'reset role';if (select started_at from public.punch_sessions where id=sa)<>'2026-10-20 12:30Z'::timestamptz then raise exception 'Approved correction not applied';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);v:=public.set_supervisor_approvals(c,da,sup,false,true,v,'Switch to leave only');
 perform set_config('request.jwt.claim.sub',sup::text,true);execute 'set local role authenticated';inbox:=public.supervisor_approval_inbox(c);if jsonb_array_length(inbox)<>1 or inbox->0->>'id'<>leave_id::text then raise exception 'Independent permissions failed';end if;perform public.review_leave(leave_id,true,'Scoped leave approval');execute 'reset role';
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_essential_supervisor(c,da,sup,false,false);perform public.set_essential_supervisor(c,da,sup,false,true);
 if exists(select 1 from public.essential_supervisors where company_id=c and user_id=sup and (can_approve_time or can_approve_leave)) then raise exception 'Revocation resurrected permissions';end if;
 select approval_version into v from public.essential_supervisors where company_id=c and department_id=da and user_id=sup;v:=public.set_supervisor_approvals(c,da,sup,true,true,v,'Temporary delegate');update public.company_members set status='disabled' where company_id=c and user_id=sup;update public.company_members set status='active' where company_id=c and user_id=sup;if exists(select 1 from public.essential_supervisors where company_id=c and user_id=sup and (active or can_approve_time or can_approve_leave)) then raise exception 'Membership reactivation resurrected scope';end if;
 if (select count(*) from public.app_notifications where company_id=c and recipient_id=a and kind in('punch_correction_requests_decision','leave_requests_decision'))<>2 then raise exception 'Missing decision notifications';end if;
end $$;
rollback;
