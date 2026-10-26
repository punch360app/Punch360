begin;
do $$
declare boss_a uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 emp_a uuid:=gen_random_uuid();emp_b uuid:=gen_random_uuid();emp_peer uuid:=gen_random_uuid();
 tenant_a uuid;tenant_b uuid;loc uuid;worker uuid;shift uuid;old public.scheduled_shifts;row jsonb;records jsonb;
 already uuid:=gen_random_uuid();msgs integer;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss_a,boss_a||'@visit.invalid',now()),(boss_b,boss_b||'@visit.invalid',now()),
 (emp_a,emp_a||'@visit.invalid',now()),(emp_b,emp_b||'@visit.invalid',now()),
 (emp_peer,emp_peer||'@visit.invalid',now());
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 tenant_a:=public.create_company_for_edition('Visit notice A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 tenant_b:=public.create_company_for_edition('Visit notice B','essential');
 update public.companies set billing_status='active',is_test=true,billing_mode='test_simulated',seat_limit=20
 where id in(tenant_a,tenant_b);
 insert into public.company_members(company_id,user_id,role,status) values
 (tenant_a,emp_a,'employee','active'),(tenant_b,emp_b,'employee','active'),
 (tenant_a,emp_peer,'employee','active');
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 select id into loc from public.essential_locations where company_id=tenant_a limit 1;
 select id into worker from public.company_workers where company_id=tenant_a and auth_user_id=emp_a;
 if worker is null or loc is null then raise exception 'Invalid test setup';end if;
 shift:=public.save_essential_shift(tenant_a,worker,loc,null,clock_timestamp()+interval '5 hours',
 clock_timestamp()+interval '9 hours');
 select * into old from public.scheduled_shifts where id=shift;
 if has_table_privilege('authenticated','private.essential_visit_issues','select') then
 raise exception 'Private visit reports directly exposed';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',emp_b::text,true);
 denied:=false;begin perform public.report_essential_visit_issue(shift,old.version,'late','cross-company',gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company employee can report';end if;
 denied:=false;begin perform public.list_essential_visit_issues(tenant_a,now(),now()+interval '2 days');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company can read';end if;
 perform set_config('request.jwt.claim.sub',emp_peer::text,true);
 denied:=false;begin perform public.report_essential_visit_issue(shift,old.version,'late','not assigned',gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other employee can report';end if;
 perform set_config('request.jwt.claim.sub',emp_a::text,true);
 denied:=false;begin perform public.report_essential_visit_issue(shift,old.version,'anything','not a valid type',gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Unvalidated category';end if;
 row:=public.report_essential_visit_issue(shift,old.version,'late','Je serai en retard, pas d ETA',already);
 if row->>'duplicate'<>'false' then raise exception 'First report failed';end if;
 row:=public.report_essential_visit_issue(shift,old.version,'late','Je serai en retard, pas d ETA',already);
 if row->>'duplicate'<>'true' then raise exception 'Duplicate report caused another event';end if;
 row:=public.report_essential_visit_issue(shift,old.version,'access','La porte est barrée',gen_random_uuid());
 if row->>'duplicate'<>'false' then raise exception 'Separate event type suppressed';end if;
 records:=public.list_essential_visit_issues(tenant_a,now(),now()+interval '2 days');
 if jsonb_array_length(records->'items')<>2 then raise exception 'Worker cannot see own two reports';end if;
 if records::text not like '%La porte est barrée%' then raise exception 'Worker cannot review own message';end if;
 perform set_config('request.jwt.claim.sub',emp_peer::text,true);
 records:=public.list_essential_visit_issues(tenant_a,now(),now()+interval '2 days');
 if jsonb_array_length(records->'items')<>0 then raise exception 'Peer accessed notes';end if;
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 records:=public.list_essential_visit_issues(tenant_a,now(),now()+interval '2 days');
 if jsonb_array_length(records->'items')<>2 then raise exception 'Manager missing actual worker reports';end if;
 -- The boss may read only their own company notification inbox, never employee's.
 select count(*) into msgs from public.app_notifications where company_id=tenant_a
 and recipient_id=boss_a and kind in ('shift_visit_late','shift_visit_access');
 if msgs<>2 then raise exception 'Manager notification count %, expected 2',msgs;end if;
 if exists(select 1 from public.app_notifications where company_id=tenant_a
 and (body ilike '%La porte%' or body ilike '%en retard%')) then
 raise exception 'Private free text leaked via notification';end if;
 denied:=false;
 begin perform public.report_essential_visit_issue(shift,old.version,'late','boss cannot impersonate',gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Manager can impersonate employee';end if;
 execute 'reset role';
 if (select count(*) from private.essential_visit_issues where company_id=tenant_a)<>2 then
 raise exception 'Not exactly two events persisted';end if;
 if (select version from public.scheduled_shifts where id=shift)<>old.version or
 (select starts_at from public.scheduled_shifts where id=shift)<>old.starts_at or
 (select ends_at from public.scheduled_shifts where id=shift)<>old.ends_at or
 (select worker_id from public.scheduled_shifts where id=shift)<>old.worker_id then
 raise exception 'Visit report mutated shift';end if;
 if has_function_privilege('anon','public.report_essential_visit_issue(uuid,integer,text,text,uuid)','execute') then
 raise exception 'Anon report allowed';end if;
end $$;
rollback;