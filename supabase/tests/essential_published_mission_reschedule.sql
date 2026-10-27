begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();
 employee uuid:=gen_random_uuid();other_employee uuid:=gen_random_uuid();
 company uuid;company_b uuid;w uuid;client uuid;site1 uuid;site2 uuid;foreign_client uuid;foreign_site uuid;
 m1 uuid;m2 uuid;request uuid:=gen_random_uuid();d date:=current_date+3;next_day date:=current_date+4;
 result jsonb;preview jsonb;denied boolean;before_jobs int;before_punch int;before_shifts int;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss,boss||'@reschedule.test.invalid',now()),(other_boss,other_boss||'@reschedule.test.invalid',now()),
  (employee,employee||'@reschedule.test.invalid',now()),(other_employee,other_employee||'@reschedule.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Reschedule company A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 company_b:=public.create_company_for_edition('Reschedule company B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
  where id in(company,company_b);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,employee,'employee','active'),(company,other_employee,'employee','active');
 select id into w from public.company_workers where company_id=company and auth_user_id=employee;
 select count(*) into before_jobs from public.jobs where company_id=company;
 select count(*) into before_punch from public.punch_sessions where company_id=company;
 select count(*) into before_shifts from public.scheduled_shifts where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 result:=public.save_essential_client(company_b,null,0,'Foreign client','','','',true);
 foreign_client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company_b,null,0,foreign_client,'Foreign site','999 ailleurs','','Québec','QC','G1R 1A1','CA',
  'America/Toronto',null,null,'','','','',true);
 foreign_site:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(company,null,0,'Client local','','','',true);
 client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client,'Bureau','100 rue A','','Québec','QC','G1R 1A1','CA',
  'America/Toronto',null,null,'','','','',true);
 site1:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client,'Maison','200 rue B','','Québec','QC','G1R 1A1','CA',
  'America/Toronto',null,null,'','','','',true);
 site2:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(company,true);
 result:=public.save_essential_mission(company,null,0,w,site1,d,1,'Mission initiale','Note privée',true);
 m1:=(result->>'id')::uuid;
 result:=public.save_essential_mission(company,null,0,w,site1,next_day,2,'Rang occupé','',true);
 m2:=(result->>'id')::uuid;
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,1,gen_random_uuid(),next_day,site2,2,'Collision demandée');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Reschedule allowed an occupied rank';end if;
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,1,gen_random_uuid(),next_day,foreign_site,1,'Site étranger');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-company site accepted';end if;
 result:=public.reschedule_essential_published_mission(company,m1,1,request,next_day,site2,1,'Client déplacé');
 if result->>'duplicate'<>'false' or (result->>'version')::integer<>2 or result->>'notified'<>'true'
 then raise exception 'Expected reprogrammed version and targeted notice: %',result;end if;
 result:=public.reschedule_essential_published_mission(company,m1,1,request,next_day,site2,1,'Client déplacé');
 if result->>'duplicate'<>'true' or (result->>'version')::integer<>2
 then raise exception 'Idempotent retry not honored: %',result;end if;
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,1,request,next_day,site2,3,'Client déplacé');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Reused request with changed rank was accepted';end if;
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,1,gen_random_uuid(),next_day,site2,3,'Version expirée');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale mission version accepted';end if;
 preview:=public.list_essential_missions(company,d,w,false);
 if jsonb_array_length(preview->'items')<>0 then raise exception 'Old day still contains moved mission';end if;
 preview:=public.list_essential_missions(company,next_day,w,false);
 if jsonb_array_length(preview->'items')<>2 or preview->'items'->0->>'id'<>m1::text or
  preview->'items'->0->>'site_id'<>site2::text then
  raise exception 'Published route did not move to new day/site: %',preview;end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,2,gen_random_uuid(),next_day,site1,3,'Interdit au salarié');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee reprogrammed mission';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,2,gen_random_uuid(),next_day,site1,3,'Autre compagnie');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company manager reprogrammed mission';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 result:=public.complete_essential_mission(company,m1,2,gen_random_uuid());
 if result->>'status'<>'completed' then raise exception 'Employee completion failed';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;
 begin perform public.reschedule_essential_published_mission(company,m1,3,gen_random_uuid(),next_day,site1,3,'Déjà terminée');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Completed mission rescheduled';end if;
 execute 'reset role';
 if (select count(*) from public.jobs where company_id=company)<>before_jobs or
    (select count(*) from public.punch_sessions where company_id=company)<>before_punch or
    (select count(*) from public.scheduled_shifts where company_id=company)<>before_shifts
 then raise exception 'Reschedule changed jobs, shifts or punches';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=employee
   and title='Intervention reprogrammée')<>1 then raise exception 'Expected precisely one employee reschedule notice';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=other_employee
   and title='Intervention reprogrammée')<>0 then raise exception 'Wrong employee notified';end if;
 if has_table_privilege('authenticated','private.essential_mission_reschedule_requests','select') or
   has_function_privilege('anon','public.reschedule_essential_published_mission(uuid,uuid,integer,uuid,date,uuid,integer,text)','execute')
 then raise exception 'Private requests or RPC exposed to forbidden roles';end if;
end $$;
rollback;
