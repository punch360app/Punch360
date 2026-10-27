begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();other_employee uuid:=gen_random_uuid();
 company uuid;company_b uuid;w uuid;w2 uuid;client uuid;site uuid;
 m1 uuid;m2 uuid;m3 uuid;other_worker_mission uuid;
 target_day date:=current_date+3;res jsonb;data jsonb;denied boolean;
 before_jobs integer;before_punch integer;before_shifts integer;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@swap.test.invalid',now()),(other_boss,other_boss||'@swap.test.invalid',now()),
 (employee,employee||'@swap.test.invalid',now()),(other_employee,other_employee||'@swap.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Mission order A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 company_b:=public.create_company_for_edition('Mission order B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
  where id in(company,company_b);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,employee,'employee','active'),(company,other_employee,'employee','active');
 select id into w from public.company_workers where company_id=company and auth_user_id=employee;
 select id into w2 from public.company_workers where company_id=company and auth_user_id=other_employee;
 select count(*) into before_jobs from public.jobs where company_id=company;
 select count(*) into before_punch from public.punch_sessions where company_id=company;
 select count(*) into before_shifts from public.scheduled_shifts where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 res:=public.save_essential_client(company,null,0,'Interventions Nord','','','',true);client:=(res->>'id')::uuid;
 res:=public.save_essential_client_site(company,null,0,client,'Rue 1','100 rue du Commerce','','Québec','QC','G1R 1A1','CA',
  'America/Toronto',null,null,'','','Code private','Notes privées',true);site:=(res->>'id')::uuid;
 perform public.essential_missions_configuration(company,true);
 res:=public.save_essential_mission(company,null,0,w,site,target_day,1,'Premier arrêt','Secret interne A',true);m1:=(res->>'id')::uuid;
 res:=public.save_essential_mission(company,null,0,w,site,target_day,2,'Deuxième arrêt','Secret interne B',true);m2:=(res->>'id')::uuid;
 res:=public.save_essential_mission(company,null,0,w,site,target_day,3,'Troisième arrêt','',true);m3:=(res->>'id')::uuid;
 res:=public.save_essential_mission(company,null,0,w2,site,target_day,1,'Autre personne','',true);other_worker_mission:=(res->>'id')::uuid;
 res:=public.swap_essential_published_missions(company,m1,1,m2,1);
 if (res->>'first_order')::int<>2 or (res->>'second_order')::int<>1 or
    (res->>'first_version')::int<>2 or (res->>'second_version')::int<>2 or res->>'notified'<>'true'
 then raise exception 'Expected atomically swapped ranks and one targeted notification: %',res;end if;
 data:=public.list_essential_missions(company,target_day,w,false);
 if jsonb_array_length(data->'items')<>3 or
   data->'items'->0->>'id'<>m2::text or data->'items'->1->>'id'<>m1::text or data->'items'->2->>'id'<>m3::text then
    raise exception 'Published order not reflected in employee route: %',data;end if;
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,1,m2,1);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale version replay reordered route twice';end if;
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,2,other_worker_mission,1);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Swapped a mission belonging to another employee';end if;
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,2,m1,2);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Self-swap allowed';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,2,m2,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee modified manager order';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,2,m2,2);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-company manager reordered missions';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 res:=public.swap_essential_published_missions(company,m1,2,m2,2);
 if res->>'first_order'<>'1' or res->>'second_order'<>'2' then
   raise exception 'Versioned reverse swap failed: %',res;end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 res:=public.complete_essential_mission(company,m1,3,gen_random_uuid());
 if res->>'status'<>'completed' then raise exception 'Completion fixture failed';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;
 begin perform public.swap_essential_published_missions(company,m1,4,m2,3);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Completed mission got reordered';end if;
 execute 'reset role';
 if (select count(*) from public.jobs where company_id=company)<>before_jobs or
    (select count(*) from public.punch_sessions where company_id=company)<>before_punch or
    (select count(*) from public.scheduled_shifts where company_id=company)<>before_shifts then
  raise exception 'Swap modified jobs, punch or shifts';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=employee
  and title='Ordre de votre tournée modifié')<>2 then raise exception 'Exactly one notification per confirmed order change expected';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=other_employee
  and title='Ordre de votre tournée modifié')<>0 then raise exception 'Wrong worker notified';end if;
 if has_function_privilege('anon','public.swap_essential_published_missions(uuid,uuid,integer,uuid,integer)','execute')
 then raise exception 'Anon can reorder';end if;
end $$;
rollback;