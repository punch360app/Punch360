begin;
do $$
declare sid uuid:=gen_random_uuid();boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();admin_user uuid:=gen_random_uuid();owner_id uuid;c uuid;w uuid;s uuid;j uuid;i integer;r jsonb;estimate public.essential_payroll_estimates;item jsonb;event uuid:=gen_random_uuid();credit_request uuid:=gen_random_uuid();bank_request uuid:=gen_random_uuid();denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(emp,emp||'@test.invalid',now()),(admin_user,admin_user||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Payroll fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into public.company_members(company_id,user_id,role) values(c,emp,'employee'),(c,admin_user,'admin');select id into w from public.company_workers where company_id=c and auth_user_id=emp;select default_punch_job_id into j from public.companies where id=c;
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);perform public.platform_set_essential_test_plan(c,'essential_pro');perform set_config('request.jwt.claim.sub',boss::text,true);
 perform public.save_essential_pay_rule(c,0,'2026-10-05','America/Toronto',40,1.5,'[]','Projection de test; règles applicables à vérifier par le responsable.');perform public.add_essential_pay_rate(c,w,'2026-10-01',2500,'Taux initial de test');
 for i in 0..4 loop
 insert into public.punch_sessions(company_id,user_id,worker_id,started_at) values(c,emp,w,('2026-10-05'::date+i+time '08:00') at time zone 'America/Toronto') returning id into s;
 insert into public.punch_segments(company_id,session_id,job_id,started_at) values(c,s,j,('2026-10-05'::date+i+time '08:00') at time zone 'America/Toronto');
 if i=0 then
 perform set_config('request.jwt.claim.sub',emp::text,true);execute 'set local role authenticated';r:=public.sync_paid_break_start(event,c,'2026-10-05 10:00-04',true);if r->>'sync_status'<>'synced' then raise exception 'Paid break failed %',r;end if;perform public.sync_paid_break_start(event,c,'2026-10-05 10:00-04',true);perform public.sync_break_event(gen_random_uuid(),c,'break_end','2026-10-05 10:15-04',true,event);execute 'reset role';perform set_config('request.jwt.claim.sub',boss::text,true);
 elsif i=1 then insert into public.punch_breaks(company_id,session_id,user_id,started_at,ended_at) values(c,s,emp,'2026-10-06 12:00-04','2026-10-06 12:30-04');end if;
 update public.punch_segments set ended_at=('2026-10-05'::date+i+time '16:00') at time zone 'America/Toronto' where session_id=s;update public.punch_sessions set ended_at=('2026-10-05'::date+i+time '16:00') at time zone 'America/Toronto' where id=s;
 end loop;
 execute 'set local role authenticated';perform public.add_essential_pay_credit(c,w,'2026-10-05','holiday',8,20000,'Crédit férié fourni pour le scénario de test',credit_request);perform public.add_essential_pay_credit(c,w,'2026-10-05','holiday',8,20000,'Crédit férié fourni pour le scénario de test',credit_request);
 estimate:=public.generate_essential_payroll_estimate(c,'2026-10-05');select value into item from jsonb_array_elements(estimate.payload->'rows') where value->>'worker_id'=w::text;
 if (item->>'paid_seconds')::numeric<>39.5*3600 or (item->>'overtime_seconds')::numeric<>7.5*3600 or (item->>'estimated_cents')::numeric<>128125 then raise exception 'Paid/unpaid/credit/overtime calculation incorrect %',item;end if;
 perform public.add_essential_bank_entry(c,w,'time',90,'Crédit de banque','Demande salarié conservée selon convention applicable',bank_request);perform public.add_essential_bank_entry(c,w,'time',90,'Crédit de banque','Demande salarié conservée selon convention applicable',bank_request);
 denied:=false;begin perform public.add_essential_bank_entry(c,w,'time',-91,'Débit trop élevé','Justificatif',gen_random_uuid());exception when others then denied:=true;end;if not denied then raise exception 'Bank overdraw accepted';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);if (public.essential_bank_balances(c)->0->>'balance_minutes')::bigint<>90 then raise exception 'Server bank aggregate missing';end if;if (select sum(minutes) from public.essential_bank_entries where worker_id=w)<>90 then raise exception 'Own bank unreadable or duplicated';end if;if exists(select 1 from public.essential_pay_rates where company_id=c) then raise exception 'Employee sees private rates';end if;
 perform set_config('request.jwt.claim.sub',admin_user::text,true);denied:=false;begin perform public.generate_essential_payroll_estimate(c,'2026-10-05');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Admin sees wages without delegation';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_essential_hr_grant(c,admin_user,false,false,true,'Délégation paie limitée');perform set_config('request.jwt.claim.sub',admin_user::text,true);perform public.generate_essential_payroll_estimate(c,'2026-10-05');
 execute 'reset role';perform set_config('request.jwt.claim.sub',boss::text,true);
 -- Fall-back night: nine elapsed hours, seven within the configured premium window.
 perform public.save_essential_pay_rule(c,1,'2026-10-26','America/Toronto',40,1.5,'[{"name":"Nuit","start":"22:00","end":"06:00","cents":200}]','Projection DST; paramètres de test à valider.');
 insert into public.punch_sessions(company_id,user_id,worker_id,started_at,ended_at) values(c,emp,w,'2026-11-01 00:00-04','2026-11-01 08:00-05') returning id into s;insert into public.punch_segments(company_id,session_id,job_id,started_at,ended_at) values(c,s,j,'2026-11-01 00:00-04','2026-11-01 08:00-05');
 estimate:=public.generate_essential_payroll_estimate(c,'2026-10-26');select value into item from jsonb_array_elements(estimate.payload->'rows') where value->>'worker_id'=w::text;
 if (item->>'paid_seconds')::numeric<>9*3600 or (item->>'premium_cents')::numeric<>1400 then raise exception 'DST premium calculation incorrect %',item;end if;
 if (select count(*) from public.punch_breaks where company_id=c and is_paid)<>1 then raise exception 'Paid break duplicated';end if;
end $$;
rollback;
