begin;
do $$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();admin_user uuid:=gen_random_uuid();c uuid;w uuid;l uuid;d uuid;j uuid;s uuid;budget uuid;estimate public.essential_budget_evaluations; profile uuid;report public.essential_payroll_estimates;export_run public.essential_payroll_export_runs;retry public.essential_payroll_export_runs;request uuid:=gen_random_uuid();archive jsonb;restored jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@budget.test.invalid',now()),(emp,emp||'@budget.test.invalid',now()),(admin_user,admin_user||'@budget.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Labor budget fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(p) from public.essential_plans p where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,emp,'employee'),(c,admin_user,'admin');select id into w from public.company_workers where company_id=c and auth_user_id=emp;select id into l from public.essential_locations where company_id=c;select default_punch_job_id into j from public.companies where id=c;d:=public.save_essential_department(c,l,'Budget department');perform public.assign_essential_worker(w,l,d);
 perform public.save_essential_pay_rule(c,0,'2026-10-12','America/Toronto',40,1.5,'[]','Synthetic estimate validation');perform public.add_essential_pay_rate(c,w,'2026-10-12',2500,'Synthetic rate');
 insert into public.punch_sessions(company_id,user_id,worker_id,started_at,ended_at) values(c,emp,w,'2026-10-13 08:00-04','2026-10-13 16:00-04') returning id into s;insert into public.punch_segments(company_id,session_id,job_id,started_at,ended_at) values(c,s,j,'2026-10-13 08:00-04','2026-10-13 16:00-04');
 execute 'set local role authenticated';
 profile:=public.save_payroll_export_profile(c,null,0,'Synthetic CSV','[{"key":"external_id","header":"Employee"},{"key":"regular_hours","header":"Regular"},{"key":"estimated_amount","header":"Gross"}]',',',true,'Synthetic configuration');
 report:=public.generate_essential_payroll_estimate(c,'2026-10-12');
 denied:=false;begin perform public.prepare_payroll_export(profile,1,report.id,request);exception when others then denied:=true;end;if not denied then raise exception 'Open week exported';end if;
 -- Fixed finished week, synthetic fixtures only, all rolled back.
 perform public.set_payroll_week(c,'2026-10-12',true,'Synthetic closure');report:=public.generate_essential_payroll_estimate(c,'2026-10-12');
 denied:=false;begin perform public.prepare_payroll_export(profile,1,report.id,request);exception when others then denied:=true;end;if not denied then raise exception 'Unmapped worker exported';end if;
 perform public.save_payroll_worker_mapping(profile,w,'EMP-001',0,'Synthetic mapping');
 export_run:=public.prepare_payroll_export(profile,1,report.id,request);retry:=public.prepare_payroll_export(profile,1,report.id,request);
 if retry.id<>export_run.id or jsonb_array_length(export_run.payload->'rows')<>1 or (export_run.payload->'rows'->0->>'regular_hours')::numeric<>8 or (export_run.payload->'rows'->0->>'estimated_amount')::numeric<>200 then raise exception 'Export arithmetic or idempotency incorrect';end if;
 denied:=false;begin perform public.save_payroll_worker_mapping(profile,w,'EMP-002',0,'Stale mapping');exception when others then denied:=true;end;if not denied then raise exception 'Stale mapping accepted';end if;
 perform public.add_essential_pay_rate(c,w,'2026-10-12',3000,'Synthetic rate revision');denied:=false;begin perform public.prepare_payroll_export(profile,1,report.id,gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Stale estimate accepted';end if;
 if (export_run.payload->'rows'->0->>'estimated_amount')::numeric<>200 then raise exception 'Snapshot changed';end if;
 budget:=public.save_essential_labor_budget(c,d,'2026-10-12',30000,0,'Synthetic archived budget');
 execute 'reset role';archive:=private.company_archive_payload(c);
 if jsonb_array_length(archive->'collections'->'public.essential_payroll_export_runs')<>1 or jsonb_array_length(archive->'collections'->'public.essential_labor_budgets')<>1 then raise exception 'Archive missing payroll or budget collection';end if;
 delete from public.essential_payroll_export_runs where company_id=c;delete from public.essential_payroll_worker_mappings where company_id=c;delete from public.essential_payroll_export_profiles where company_id=c;
 restored:=private.company_restore_apply(archive,c);
 if not exists(select 1 from public.essential_payroll_export_profiles where company_id=c and id=profile and not active) or not exists(select 1 from public.essential_payroll_export_runs where company_id=c and id=export_run.id) or not exists(select 1 from public.essential_payroll_worker_mappings where company_id=c and profile_id=profile and external_id='EMP-001') then raise exception 'Payroll recovery missing or profile reactivated';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',admin_user::text,true);denied:=false;begin perform public.prepare_payroll_export(profile,1,report.id,gen_random_uuid());exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Admin without compensation read budgets';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);if exists(select 1 from public.essential_payroll_export_profiles where company_id=c) or exists(select 1 from public.essential_payroll_worker_mappings where company_id=c) or exists(select 1 from public.essential_payroll_export_runs where company_id=c) then raise exception 'Employee budget RLS leak';end if;execute 'reset role';
end $$;
rollback;
