begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 emp_a uuid:=gen_random_uuid();emp_b uuid:=gen_random_uuid();
 c uuid;other_c uuid;location_id uuid;dept uuid;wa uuid;wb uuid;need uuid;shift uuid;
 starts timestamptz;ends timestamptz;day date:=current_date+10;
 data jsonb;denied boolean;exception_id uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss,boss||'@candidate.test.invalid',now()),(boss_b,boss_b||'@candidate.test.invalid',now()),
  (emp_a,emp_a||'@candidate.test.invalid',now()),(emp_b,emp_b||'@candidate.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Candidate A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 other_c:=public.create_company_for_edition('Candidate B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=30 where id in(c,other_c);
 insert into private.essential_test_plans(company_id,snapshot)
 select company_id,to_jsonb(p) from (values(c),(other_c)) as companies(company_id)
 cross join public.essential_plans p where p.id='essential_pro';
 insert into public.company_members(company_id,user_id,role,status) values
  (c,emp_a,'employee','active'),(c,emp_b,'employee','active');
 perform set_config('request.jwt.claim.sub',boss::text,true);
 select id into location_id from public.essential_locations where company_id=c and active limit 1;
 select id into wa from public.company_workers where company_id=c and auth_user_id=emp_a;
 select id into wb from public.company_workers where company_id=c and auth_user_id=emp_b;
 dept:=public.save_essential_department(c,location_id,'Certified team');
 perform public.assign_essential_worker(wa,location_id,dept);
 perform public.assign_essential_worker(wb,location_id,dept);
 starts:=(day::timestamp+time '09:00') at time zone 'America/Toronto';
 ends:=(day::timestamp+time '12:00') at time zone 'America/Toronto';
 execute 'set local role authenticated';
 perform public.save_essential_certification(c,wa,'First aid','certification',current_date-1,current_date+30);
 perform public.save_essential_certification(c,wb,'first AID','certification',current_date-1,current_date+30);
 need:=public.save_qualified_coverage(c,dept,'Team qualified','First aid',day::timestamp+time '09:00',day::timestamp+time '12:00',1,true,null,0,'Coverage candidates test');
 data:=public.qualified_coverage_candidates(need,starts,ends);
 if data->>'available'<>'0' or data->>'unknown'<>'2' or jsonb_array_length(data->'candidates')<>2 then
  raise exception 'No availability must be unknown: %',data;end if;
 if exists(select 1 from jsonb_array_elements(data->'candidates') item where item ? 'email' or item ? 'private_note' or item ? 'reason_code') then
  raise exception 'Sensitive information leaked';end if;
 perform public.save_essential_weekly_availability(c,wa,location_id,ARRAY[1,2,3,4,5,6,7],
  '08:00','17:00',current_date,null,true,gen_random_uuid());
 data:=public.qualified_coverage_candidates(need,starts,ends);
 if data->>'available'<>'1' or data->>'unknown'<>'1' then raise exception 'Week type not honored: %',data;end if;
 execute 'reset role';
 insert into public.essential_availability(company_id,worker_id,starts_at,ends_at,available,note)
 values(c,wa,starts,ends,false,'private test note') returning id into exception_id;
 execute 'set local role authenticated';
 data:=public.qualified_coverage_candidates(need,starts,ends);
 if data->>'available'<>'0' or data->>'unavailable'<>'1' or data->>'unknown'<>'1' then
  raise exception 'Dated exception must outrank weekly: %',data;end if;
 execute 'reset role';
 delete from public.essential_availability where id=exception_id;
 insert into public.leave_requests(company_id,user_id,leave_type,begins_on,ends_on,status)
 values(c,emp_b,'personal',day,day,'approved');
 execute 'set local role authenticated';
 data:=public.qualified_coverage_candidates(need,starts,ends);
 if data->>'available'<>'1' or data->>'unavailable'<>'1' or data->>'unknown'<>'0' then
  raise exception 'Approved leave must prevent offer: %',data;end if;
 -- A published shift reserves the worker; candidate preview must not change it.
 shift:=public.save_essential_local_shift(c,wa,location_id,dept,(day::timestamp+time '09:00'),(day::timestamp+time '12:00'),'fixture');
 data:=public.qualified_coverage_candidates(need,starts,ends);
 if data->>'available'<>'0' or data->>'unavailable'<>'2' or
    (select worker_id from public.scheduled_shifts where id=shift)<>wa then
  raise exception 'Existing assignment ignored or modified: %',data;end if;
 denied:=false;
 perform set_config('request.jwt.claim.sub',emp_a::text,true);
 begin perform public.qualified_coverage_candidates(need,starts,ends);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee can view candidates';end if;
 denied:=false;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 begin perform public.qualified_coverage_candidates(need,starts,ends);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company can view candidates';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.qualified_coverage_candidates(uuid,timestamptz,timestamptz)','execute') then
  raise exception 'Anonymous RPC has EXECUTE';end if;
end $$;
rollback;
