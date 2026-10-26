begin;
do $$
declare boss uuid:=gen_random_uuid();boss_other uuid:=gen_random_uuid();worker uuid:=gen_random_uuid();
 v_company uuid;other_company uuid;loc uuid;job uuid;old_address text;response jsonb;
 count_locations integer;count_jobs integer;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@fixednavigation.test.invalid',now()),
 (boss_other,boss_other||'@fixednavigation.test.invalid',now()),
 (worker,worker||'@fixednavigation.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 v_company:=public.create_company_for_edition('Fixed address correct A','essential');
 perform set_config('request.jwt.claim.sub',boss_other::text,true);
 other_company:=public.create_company_for_edition('Fixed address correct B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=15
 where id in (v_company,other_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(v_company,worker,'employee','active');
 select id,punch_job_id,coalesce(address,'') into loc,job,old_address from public.essential_locations x
  where x.company_id=v_company and active order by created_at limit 1;
 -- Qualify using table alias to avoid variable ambiguity.
 if loc is null or job is null then raise exception 'Fixture missing fixed location/job';end if;
 select count(*) into count_locations from public.essential_locations x where x.company_id=v_company;
 select count(*) into count_jobs from public.jobs x where x.company_id=v_company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 response:=public.update_essential_location_address(v_company,loc,old_address,
   '123 rue des Érables, Charlesbourg, QC G1H 1A1');
 if response->>'navigation_updated'<>'true' or response->>'gps_geofence_unchanged'<>'true' then
  raise exception 'Business address update failed: %',response;end if;
 response:=public.update_essential_location_address(v_company,loc,
  '123 rue des Érables, Charlesbourg, QC G1H 1A1',
  '123 rue des Érables, Charlesbourg, QC G1H 1A1');
 if response->>'unchanged'<>'true' then raise exception 'Idempotent update did not return unchanged';end if;
 denied:=false;
 begin perform public.update_essential_location_address(v_company,loc,old_address,'456 rue Cartier, Québec QC');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale address update permitted';end if;
 denied:=false;
 begin perform public.update_essential_location_address(v_company,loc,
   '123 rue des Érables, Charlesbourg, QC G1H 1A1','456 rue Cartier'||E'\n'||'Bad');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Multi-line address unexpectedly accepted';end if;
 perform set_config('request.jwt.claim.sub',worker::text,true);
 denied:=false;
 begin perform public.update_essential_location_address(v_company,loc,
   '123 rue des Érables, Charlesbourg, QC G1H 1A1','456 rue Cartier, Québec QC');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee wrote address';end if;
 perform set_config('request.jwt.claim.sub',boss_other::text,true);
 denied:=false;
 begin perform public.update_essential_location_address(v_company,loc,
   '123 rue des Érables, Charlesbourg, QC G1H 1A1','456 rue Cartier, Québec QC');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company changed address';end if;
 execute 'reset role';
 if (select x.address from public.essential_locations x where x.id=loc)<>'123 rue des Érables, Charlesbourg, QC G1H 1A1'
   or (select x.address from public.jobs x where x.id=job)<>'123 rue des Érables, Charlesbourg, QC G1H 1A1' then
  raise exception 'Location or job display address not synchronized';end if;
 if (select count(*) from public.essential_locations x where x.company_id=v_company)<>count_locations or
    (select count(*) from public.jobs x where x.company_id=v_company)<>count_jobs then
  raise exception 'Updating existing address created another establishment or job';end if;
 if (select count(*) from public.workforce_audit a where a.company_id=v_company
  and a.action='essential_location_address_updated' and a.entity_id=loc)<>1 then
  raise exception 'Audit count not exactly one';end if;
 if exists(select 1 from public.workforce_audit a where a.company_id=v_company
  and a.action='essential_location_address_updated' and a.before_value::text ilike '%Érables%') then
  raise exception 'Address leaked in audit trail';end if;
 if has_function_privilege('anon','public.update_essential_location_address(uuid,uuid,text,text)','execute') then
  raise exception 'Anon can update address';end if;
end $$;
rollback;