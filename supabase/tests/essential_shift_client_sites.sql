-- MLOC-002: synthetic two-client same-day shifts within one company,
-- a foreign company, privacy, version conflicts and no changes to hours/punch/jobs.
begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();company uuid;foreign_company uuid;
 worker_a uuid;worker_b uuid;loc uuid;client_a uuid;client_b uuid;site_a uuid;site_b uuid;
 shift_am uuid;shift_pm uuid;first_day date:=current_date+10;
 before_shift public.scheduled_shifts;after_shift public.scheduled_shifts;
 result jsonb;details jsonb;denied boolean;jobs_before integer;punch_before integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@multi-site.invalid',now()),(other_boss,other_boss||'@multi-site.invalid',now()),
 (a,a||'@multi-site.invalid',now()),(b,b||'@multi-site.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Client sites planner','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 foreign_company:=public.create_company_for_edition('Other sites planner','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(company,foreign_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,a,'employee','active'),(company,b,'employee','active');
 select id into loc from public.essential_locations where company_id=company and active limit 1;
 select id into worker_a from public.company_workers where company_id=company and auth_user_id=a;
 select id into worker_b from public.company_workers where company_id=company and auth_user_id=b;
 select count(*) into jobs_before from public.jobs where company_id=company;
 select count(*) into punch_before from public.punch_sessions where company_id=company;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 result:=public.save_essential_client(company,null,0,'Clinique Nadine','','','',true);
 client_a:=(result->>'id')::uuid;
 result:=public.save_essential_client(company,null,0,'Condo Mathieu','','','',true);
 client_b:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client_a,'Nettoyage matin',
  '123 rue des Érables','','Saint-Augustin-de-Desmaures','QC','G3A 0A1','CA',
  'America/Toronto',null,null,'Nadine','','Entrée secondaire','Code secret de test',true);
 site_a:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client_b,'Nettoyage après-midi',
  '456 avenue Royale','Bureau 2','Charlesbourg','QC','G1H 0A1','CA',
  'America/Toronto',null,null,'Mathieu','','Accès réception','Contact personnel caché',true);
 site_b:=(result->>'id')::uuid;
 shift_am:=public.save_essential_local_shift(company,worker_a,loc,null,
  first_day::timestamp+time '08:00',first_day::timestamp+time '12:00','Matin');
 shift_pm:=public.save_essential_local_shift(company,worker_a,loc,null,
  first_day::timestamp+time '13:00',first_day::timestamp+time '16:00','Après-midi');
 select * into before_shift from public.scheduled_shifts where id=shift_am;
 result:=public.set_essential_shift_client_site(company,shift_am,site_a,1);
 if result->>'unchanged'<>'false' or (result->>'version')::int<>2 then
  raise exception 'Morning site not linked: %',result;end if;
 result:=public.set_essential_shift_client_site(company,shift_pm,site_b,1);
 if result->>'unchanged'<>'false' or result->>'notified'<>'true' then
  raise exception 'Afternoon site or notice missing: %',result;end if;
 select * into after_shift from public.scheduled_shifts where id=shift_am;
 if after_shift.client_site_id<>site_a or after_shift.starts_at<>before_shift.starts_at or
  after_shift.ends_at<>before_shift.ends_at or after_shift.worker_id<>before_shift.worker_id
 then raise exception 'Assignment changed hours or worker';end if;
 result:=public.set_essential_shift_client_site(company,shift_am,site_a,2);
 if result->>'unchanged'<>'true' or (result->>'version')::int<>2 then
  raise exception 'Repeated assignment must not create version/notice';end if;
 denied:=false;begin perform public.set_essential_shift_client_site(company,shift_am,site_b,1);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale expected version permitted';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=a and kind='shift_site_changed')<>2 then
  raise exception 'Expected exactly one notification per real change';end if;
 -- Employee sees only their own two locations and no internal manager-only notes.
 perform set_config('request.jwt.claim.sub',a::text,true);
 details:=public.list_essential_assigned_client_sites(company,
  (first_day::timestamp at time zone 'America/Toronto')-interval '1 day',
  ((first_day+1)::timestamp at time zone 'America/Toronto'));
 if jsonb_array_length(details->'items')<>2 or
   not exists(select 1 from jsonb_array_elements(details->'items') x where x->>'city'='Charlesbourg') or
   not exists(select 1 from jsonb_array_elements(details->'items') x where x->>'city'='Saint-Augustin-de-Desmaures')
 then raise exception 'Employee cannot see both scheduled addresses: %',details;end if;
 if exists(select 1 from jsonb_array_elements(details->'items') x
  where x ? 'internal_notes' or x ? 'private_note') then
  raise exception 'Private site notes were exposed';end if;
 denied:=false;begin perform public.set_essential_shift_client_site(company,shift_am,site_b,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee assigned own site';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 details:=public.list_essential_assigned_client_sites(company,
  (first_day::timestamp at time zone 'America/Toronto')-interval '1 day',
  ((first_day+1)::timestamp at time zone 'America/Toronto'));
 if jsonb_array_length(details->'items')<>0 then raise exception 'Coworker address exposed';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;begin perform public.list_essential_assigned_client_sites(company,now(),now()+interval '7 days');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company can list shift destinations';end if;
 denied:=false;begin perform public.set_essential_shift_client_site(company,shift_am,site_b,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company edited destination';end if;
 -- Archived address stays on the historical shift but cannot be reassigned.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 perform public.save_essential_client_site(company,site_a,1,client_a,'Nettoyage matin',
  '123 rue des Érables','','Saint-Augustin-de-Desmaures','QC','G3A 0A1','CA',
  'America/Toronto',null,null,'Nadine','','Entrée secondaire','Code secret de test',false);
 details:=public.list_essential_assigned_client_sites(company,
  (first_day::timestamp at time zone 'America/Toronto')-interval '1 day',
  ((first_day+1)::timestamp at time zone 'America/Toronto'));
 if jsonb_array_length(details->'items')<>2 then raise exception 'Archived site erased planned history';end if;
 denied:=false;begin perform public.set_essential_shift_client_site(company,shift_pm,site_a,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Archived site could be assigned to future shift';end if;
 execute 'reset role';
 if (select count(*) from public.punch_sessions where company_id=company)<>punch_before or
    (select count(*) from public.jobs where company_id=company)<>jobs_before
 then raise exception 'Address assignment changed punch session or jobs';end if;
 if has_function_privilege('anon','public.list_essential_assigned_client_sites(uuid,timestamptz,timestamptz)','execute')
 then raise exception 'Anonymous destination list allowed';end if;
end $$;
rollback;
