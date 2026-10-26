begin;
do $$
declare boss uuid:=gen_random_uuid();boss_other uuid:=gen_random_uuid();
 worker_user uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();
 company uuid;foreign_company uuid;location_id uuid;worker_a uuid;worker_b uuid;
 client_id uuid;site_id uuid;mission_a uuid;mission_b uuid;request_id uuid:=gen_random_uuid();
 result jsonb;preview jsonb;denied boolean;before_punch integer;before_shift integer;before_jobs integer;
 day date:=current_date+3;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@mission.test.invalid',now()),(boss_other,boss_other||'@mission.test.invalid',now()),
 (worker_user,worker_user||'@mission.test.invalid',now()),(other_user,other_user||'@mission.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Missions service A','essential');
 perform set_config('request.jwt.claim.sub',boss_other::text,true);
 foreign_company:=public.create_company_for_edition('Missions service B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(company,foreign_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,worker_user,'employee','active'),(company,other_user,'employee','active');
 select id into worker_a from public.company_workers where company_id=company and auth_user_id=worker_user;
 select id into worker_b from public.company_workers where company_id=company and auth_user_id=other_user;
 select count(*) into before_punch from public.punch_sessions where company_id=company;
 select count(*) into before_shift from public.scheduled_shifts where company_id=company;
 select count(*) into before_jobs from public.jobs where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(company,null,0,'Clinique Nadine','','','',true);
 client_id:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client_id,
 'Clinique matin','123 rue des Érables','','Saint-Augustin-de-Desmaures','QC','G3A 1A1','CA',
 'America/Toronto',null,null,'Nadine','','Code accès réservé','MOTDEPASSE-PRIVE',true);
 site_id:=(result->>'id')::uuid;
 result:=public.essential_missions_configuration(company,null);
 if result->>'enabled'<>'false' then raise exception 'Missions should be OFF by default';end if;
 denied:=false;
 begin perform public.save_essential_mission(company,null,0,worker_a,site_id,day,1,'Nettoyage','Code 1234',true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Created while disabled';end if;
 result:=public.essential_missions_configuration(company,true);
 if result->>'enabled'<>'true' then raise exception 'Manager activation failed';end if;
 result:=public.save_essential_mission(company,null,0,worker_a,site_id,day,1,'Nettoyage','Entrée côté est',false);
 mission_a:=(result->>'id')::uuid;
 if result->>'status'<>'draft' then raise exception 'Draft missing';end if;
 result:=public.save_essential_mission(company,null,0,worker_a,site_id,day,2,'Inspection','',true);
 mission_b:=(result->>'id')::uuid;
 if result->>'notification_sent'<>'true' then raise exception 'Publication notification not sent';end if;
 preview:=public.list_essential_missions(company,day,null,true);
 if jsonb_array_length(preview->'items')<>2 then raise exception 'Manager draft not listed';end if;
 denied:=false;
 begin perform public.save_essential_mission(company,null,0,worker_a,site_id,day,2,'Collision','',true);
 exception when unique_violation then denied:=true;end;
 if not denied then raise exception 'Two published missions with same order';end if;
 result:=public.save_essential_mission(company,mission_a,1,worker_a,site_id,day,1,'Nettoyage','Entrée côté est',true);
 if result->>'status'<>'published' or (result->>'version')::integer<>2 then raise exception 'Draft publish failed';end if;
 denied:=false;
 begin perform public.save_essential_mission(company,mission_a,2,worker_b,site_id,day,3,'Silent handoff','',true);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Published mission silently reassignable';end if;
 perform set_config('request.jwt.claim.sub',worker_user::text,true);
 preview:=public.list_essential_missions(company,day,null,false);
 if jsonb_array_length(preview->'items')<>2 or
  preview->'items'->0->>'sort_order'<>'1' or preview->'items'->1->>'sort_order'<>'2' then
  raise exception 'Worker does not see ordered published jobs: %',preview;end if;
 if preview::text like '%MOTDEPASSE-PRIVE%' or preview::text like '%Code 1234%' or
   preview::text like '%Entrée côté est%' then raise exception 'Site or mission private notes leaked';end if;
 denied:=false;begin perform public.list_essential_missions(company,day,null,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee sees draft flag';end if;
 denied:=false;begin perform public.essential_missions_configuration(company,false);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee toggled company mission setting';end if;
 result:=public.complete_essential_mission(company,mission_a,2,request_id);
 if result->>'status'<>'completed' or result->>'duplicate'<>'false' or (result->>'version')::integer<>3 then
  raise exception 'Employee completion not recorded: %',result;end if;
 result:=public.complete_essential_mission(company,mission_a,2,request_id);
 if result->>'duplicate'<>'true' or (result->>'version')::integer<>3 then raise exception 'Replay double-counted';end if;
 denied:=false;begin perform public.complete_essential_mission(company,mission_a,3,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Distinct request re-completed mission';end if;
 preview:=public.list_essential_missions(company,day,null,false);
 if preview->'items'->0->>'status'<>'completed' or preview->'items'->1->>'status'<>'published' then
  raise exception 'Next mission progression incorrect';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);
 denied:=false;begin perform public.complete_essential_mission(company,mission_b,1,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other employee completed mission';end if;
 preview:=public.list_essential_missions(company,day,null,false);
 if jsonb_array_length(preview->'items')<>0 then raise exception 'Co-worker saw mission';end if;
 perform set_config('request.jwt.claim.sub',boss_other::text,true);
 denied:=false;begin perform public.list_essential_missions(company,day,null,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company could list missions';end if;
 denied:=false;begin perform public.save_essential_mission(company,null,0,worker_a,site_id,day,5,'Outside user','',true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company created mission';end if;
 execute 'reset role';
 if (select count(*) from public.punch_sessions where company_id=company)<>before_punch or
    (select count(*) from public.scheduled_shifts where company_id=company)<>before_shift or
    (select count(*) from public.jobs where company_id=company)<>before_jobs then
  raise exception 'Mission processing changed punch, job or shift count';end if;
 if has_table_privilege('authenticated','private.essential_missions','select') or
  has_function_privilege('anon','public.list_essential_missions(uuid,date,uuid,boolean)','execute') then
  raise exception 'Mission private data exposed';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=worker_user and kind='mission_published')<>2 then
  raise exception 'Wrong publication notification count';end if;
end $$;
rollback;
