begin;
do $$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();c uuid;l uuid;d uuid;w uuid;rule uuid;shift uuid;cert uuid;report jsonb;gap_seconds numeric;denied boolean;archive jsonb;restored jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@coverage.test.invalid',now()),(emp,emp||'@coverage.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Qualified coverage fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(p) from public.essential_plans p where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,emp,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=emp;select id into l from public.essential_locations where company_id=c;d:=public.save_essential_department(c,l,'Coverage');perform public.assign_essential_worker(w,l,d);
 execute 'set local role authenticated';
 shift:=public.save_essential_local_shift(c,w,l,d,'2026-10-31 23:00','2026-11-01 03:00','DST night');
 cert:=public.save_essential_certification(c,w,'First aid','certification','2026-01-01','2026-10-31');
 rule:=public.save_qualified_coverage(c,d,'First aid night',' first AID ','2026-10-31 23:00','2026-11-01 03:00',1,true,null,0,'Synthetic requirement');
 report:=public.qualified_coverage_report(c,'2026-10-31 23:00-04','2026-11-01 03:00-05');
 select sum(extract(epoch from (g->>'ends_at')::timestamptz-(g->>'starts_at')::timestamptz)) into gap_seconds from jsonb_array_elements(report->'gaps') g;
 if gap_seconds<>14400 or (report->>'rules')::integer<>1 then raise exception 'Expiry at local midnight/DST not respected: %',report;end if;
 perform public.save_essential_certification(c,w,'First aid','certification','2026-01-01','2026-11-01',null,cert,1);
 report:=public.qualified_coverage_report(c,'2026-10-31 23:00-04','2026-11-01 03:00-05');if (report->>'gap_count')::integer<>0 then raise exception 'Valid certification not counted';end if;
 denied:=false;begin perform public.save_qualified_coverage(c,d,'Stale rule','First aid','2026-10-31 23:00','2026-11-01 03:00',2,true,rule,0,'Stale requirement');exception when others then denied:=true;end;if not denied then raise exception 'Stale rule accepted';end if;
 execute 'reset role';insert into public.leave_requests(company_id,user_id,leave_type,begins_on,ends_on,reason,status) values(c,emp,'personal','2026-11-01','2026-11-01','Synthetic approved absence','approved');execute 'set local role authenticated';
 report:=public.qualified_coverage_report(c,'2026-10-31 23:00-04','2026-11-01 03:00-05');select sum(extract(epoch from (g->>'ends_at')::timestamptz-(g->>'starts_at')::timestamptz)) into gap_seconds from jsonb_array_elements(report->'gaps') g;if gap_seconds<>14400 then raise exception 'Approved absence counted as coverage';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);if exists(select 1 from public.essential_qualified_coverage where company_id=c) then raise exception 'Employee read manager rules';end if;
 denied:=false;begin perform public.qualified_coverage_report(c,'2026-10-31 23:00-04','2026-11-01 03:00-05');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Employee report bypass';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',boss::text,true);archive:=private.company_archive_payload(c);delete from public.essential_qualified_coverage where company_id=c and id=rule;restored:=private.company_restore_apply(archive,c);if not exists(select 1 from public.essential_qualified_coverage where company_id=c and id=rule and not active) then raise exception 'Recovered requirement activated or missing';end if;
end $$;
rollback;
