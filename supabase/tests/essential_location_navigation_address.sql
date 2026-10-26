begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();worker uuid:=gen_random_uuid();
 company uuid;other_company uuid;loc uuid;original_job uuid;original_job_address text;
 original_lat double precision;original_long double precision;v jsonb;
 address_before text;locations_before integer;jobs_before integer;shifts_before integer;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss,boss||'@fixed-nav.test.invalid',now()),
  (boss_b,boss_b||'@fixed-nav.test.invalid',now()),
  (worker,worker||'@fixed-nav.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Fixed workplace A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 other_company:=public.create_company_for_edition('Fixed workplace B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=30
 where id in(company,other_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,worker,'employee','active');
 select l.id,l.punch_job_id,l.address into loc,original_job,address_before
 from public.essential_locations l where l.company_id=company and l.active limit 1;
 if loc is null then raise exception 'Test company has no principal establishment';end if;
 select j.address,j.latitude,j.longitude into original_job_address,original_lat,original_long
 from public.jobs j where j.id=original_job and j.company_id=company;
 select count(*) into locations_before from public.essential_locations where company_id=company;
 select count(*) into jobs_before from public.jobs where company_id=company;
 select count(*) into shifts_before from public.scheduled_shifts where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 v:=public.set_essential_location_navigation_address(company,loc,1,
  '123 rue des Érables','Bureau 3','Saint-Augustin-de-Desmaures','QC',
  'G3A 0A1','CA','America/Toronto');
 if v->>'unchanged'<>'false' or v->>'version'<>'2' or v->>'address' not like '%Saint-Augustin%' then
  raise exception 'First save failed: %',v;end if;
 v:=public.set_essential_location_navigation_address(company,loc,2,
  '123 rue des Érables','Bureau 3','Saint-Augustin-de-Desmaures','QC',
  'G3A 0A1','CA','America/Toronto');
 if v->>'unchanged'<>'true' or v->>'version'<>'2' then
  raise exception 'Idempotent save failed: %',v;end if;
 denied:=false;
 begin perform public.set_essential_location_navigation_address(company,loc,1,
  '500 rue des Tests','','Québec','QC','','CA','America/Toronto');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale version could overwrite address';end if;
 denied:=false;
 begin perform public.set_essential_location_navigation_address(company,loc,2,
  '500 rue des Tests','','Québec','QC','','CA','Not/A_Timezone');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Invalid timezone was accepted';end if;
 denied:=false;
 begin perform public.set_essential_location_navigation_address(company,loc,2,
  '500 rue des Tests','','','','','CA','America/Toronto');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Incomplete structured address was accepted';end if;
 perform set_config('request.jwt.claim.sub',worker::text,true);
 denied:=false;
 begin perform public.set_essential_location_navigation_address(company,loc,2,
  '500 rue des Tests','','Québec','QC','','CA','America/Toronto');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee could edit establishment address';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;
 begin perform public.set_essential_location_navigation_address(company,loc,2,
  '500 rue des Tests','','Québec','QC','','CA','America/Toronto');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company manager edited address';end if;
 execute 'reset role';
 if (select l.navigation_address_version from public.essential_locations l where l.id=loc)<>2
  or (select l.address_components->>'unit' from public.essential_locations l where l.id=loc)<>'Bureau 3'
 then raise exception 'Saved structured address or version incorrect';end if;
 if (select l.punch_job_id from public.essential_locations l where l.id=loc)<>original_job
  or (select j.address from public.jobs j where j.id=original_job) is distinct from original_job_address
  or (select j.latitude from public.jobs j where j.id=original_job) is distinct from original_lat
  or (select j.longitude from public.jobs j where j.id=original_job) is distinct from original_long
 then raise exception 'Navigation address accidentally changed punch GPS/job';end if;
 if (select count(*) from public.essential_locations where company_id=company)<>locations_before
  or (select count(*) from public.jobs where company_id=company)<>jobs_before
  or (select count(*) from public.scheduled_shifts where company_id=company)<>shifts_before
 then raise exception 'Changing address created a branch, job or shift';end if;
 if has_function_privilege('anon','public.set_essential_location_navigation_address(uuid,uuid,integer,text,text,text,text,text,text,text)','execute')
 then raise exception 'Anonymous can edit fixed workplace';end if;
end $$;
rollback;
