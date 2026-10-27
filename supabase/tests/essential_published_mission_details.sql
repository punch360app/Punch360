begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();coworker uuid:=gen_random_uuid();
 c uuid;other_company uuid;worker uuid;client uuid;site uuid;id uuid;result jsonb;details jsonb;
 denied boolean;before_punch int;before_shift int;before_jobs int;d date:=current_date+2;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@details.test.invalid',now()),(boss_b,boss_b||'@details.test.invalid',now()),
 (employee,employee||'@details.test.invalid',now()),(coworker,coworker||'@details.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Détails A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 other_company:=public.create_company_for_edition('Détails B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
  where id in(c,other_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(c,employee,'employee','active'),(c,coworker,'employee','active');
 select id into worker from public.company_workers where company_id=c and auth_user_id=employee;
 select count(*) into before_punch from public.punch_sessions where company_id=c;
 select count(*) into before_shift from public.scheduled_shifts where company_id=c;
 select count(*) into before_jobs from public.jobs where company_id=c;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(c,null,0,'Client local','','','',true);client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(c,null,0,client,'Lieu A','11 rue du Quai','','Québec','QC','G1R 1A1','CA',
 'America/Toronto',null,null,'','','CODE-ACCES-SITE-INTERDIT','NOTE-CLIENT-INTERDITE',true);site:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(c,true);
 result:=public.save_essential_mission(c,null,0,worker,site,d,1,'Inspecter le chantier',
  'Entrer par la porte principale avant 14h.',true);
 id:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 details:=public.get_essential_published_mission_details(c,id,1);
 if details->>'title'<>'Inspecter le chantier' or
  details->>'instructions'<>'Entrer par la porte principale avant 14h.' then
  raise exception 'Worker authorized instructions not returned: %',details;end if;
 if details::text like '%CODE-ACCES-SITE-INTERDIT%' or details::text like '%NOTE-CLIENT-INTERDITE%'
  or details::text like '%worker_id%' or details::text like '%company_id%'
 then raise exception 'Private data leaked through details: %',details;end if;
 denied:=false;begin perform public.get_essential_published_mission_details(c,id,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Stale version allowed';end if;
 perform set_config('request.jwt.claim.sub',coworker::text,true);
 denied:=false;begin perform public.get_essential_published_mission_details(c,id,1);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Coworker read another mission';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.get_essential_published_mission_details(c,id,1);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company user read instructions';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;begin perform public.get_essential_published_mission_details(c,id,1);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Manager without personal employee assignment read worker details';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 result:=public.complete_essential_mission(c,id,1,gen_random_uuid());
 perform set_config('request.jwt.claim.sub',employee::text,true);
 denied:=false;begin perform public.get_essential_published_mission_details(c,id,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Completed mission exposed through published-only details';end if;
 execute 'reset role';
 if has_table_privilege('authenticated','private.essential_missions','select') or
  has_function_privilege('anon','public.get_essential_published_mission_details(uuid,uuid,integer)','execute')
 then raise exception 'Private mission table or details read exposed';end if;
 if (select count(*) from public.punch_sessions where company_id=c)<>before_punch or
   (select count(*) from public.scheduled_shifts where company_id=c)<>before_shift or
   (select count(*) from public.jobs where company_id=c)<>before_jobs then
  raise exception 'Read details modified work records';end if;
end $$;
rollback;
