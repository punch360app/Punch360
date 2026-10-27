begin;
do $$
declare boss uuid:=gen_random_uuid();foreign_boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 c uuid;other_c uuid;worker uuid;site uuid;client uuid;mission uuid;photo uuid;result jsonb;shown jsonb;
 denied boolean;before_punch integer;before_shift integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@photo.test.invalid',now()),(foreign_boss,foreign_boss||'@photo.test.invalid',now()),
 (emp,emp||'@photo.test.invalid',now()),(outsider,outsider||'@photo.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Photo evidence A','essential');
 perform set_config('request.jwt.claim.sub',foreign_boss::text,true);
 other_c:=public.create_company_for_edition('Photo evidence B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20 where id in(c,other_c);
 insert into public.company_members(company_id,user_id,role,status) values(c,emp,'employee','active');
 select w.id into worker from public.company_workers w where w.company_id=c and w.auth_user_id=emp;
 select count(*) into before_punch from public.punch_sessions where company_id=c;
 select count(*) into before_shift from public.scheduled_shifts where company_id=c;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(c,null,0,'Client photo','','','',true);
 client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(c,null,0,client,'Adresse photo',
  '12 rue des Pins','','Québec','QC','G1K 1A1','CA','America/Toronto',
  null,null,'','','', 'Instructions confidentielles',true);
 site:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(c,true);
 if (public.essential_missions_configuration(c,null)->>'photo_required')::boolean
 then raise exception 'Photo unexpectedly mandatory for existing company';end if;
 result:=public.save_essential_mission(c,null,0,worker,site,current_date+3,1,'Nettoyage photo','',true);
 mission:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',foreign_boss::text,true);
 denied:=false;begin perform public.set_essential_mission_photo_policy(c,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company manager updated policy';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.set_essential_mission_photo_policy(c,true);
 if result->>'photo_required'<>'true' then raise exception 'Photo policy not active';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 shown:=public.list_essential_missions(c,current_date+3,null,false);
 if shown->>'photo_required'<>'true' then raise exception 'Employee missing photo requirement';end if;
 denied:=false;begin perform public.set_essential_mission_photo_policy(c,false);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee modified photo policy';end if;
 denied:=false;begin perform public.complete_essential_mission(c,mission,1,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Legacy V1 bypassed photo requirement';end if;
 denied:=false;begin perform public.complete_essential_mission_v2(c,mission,1,gen_random_uuid(),null);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Legacy V2 bypassed photo requirement';end if;
 denied:=false;begin perform public.complete_essential_mission_v3(c,mission,1,gen_random_uuid(),null,null);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Legacy V3 bypassed photo requirement';end if;
 denied:=false;begin
  perform public.prepare_essential_mission_photo(other_c,mission,1);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company photo preparation accepted';end if;
 result:=public.prepare_essential_mission_photo(c,mission,1);
 photo:=(result->>'photo_id')::uuid;
 if photo is null then raise exception 'Missing private photo ID';end if;
 denied:=false;begin perform public.complete_essential_mission_v4(c,mission,1,gen_random_uuid(),null,null,photo);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unverified photo marked as proof';end if;
 denied:=false;begin perform public.commit_essential_mission_photo_upload(photo,'image/png',50);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee self-confirmed photo upload';end if;
 execute 'set local role service_role';
 perform public.commit_essential_mission_photo_upload(photo,'image/png',50);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 denied:=false;begin perform public.complete_essential_mission_v4(c,mission,1,gen_random_uuid(),null,null,photo);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Outsider finished mission';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.complete_essential_mission_v4(c,mission,1,gen_random_uuid(),null,null,photo);
 if result->>'status'<>'completed' or result->>'photo_saved'<>'true' then raise exception 'Photo completion failed: %',result;end if;
 shown:=public.list_essential_missions(c,current_date+3,null,false);
 if shown::text like '%'||photo::text||'%' then raise exception 'Private photo reference leaked to employee';end if;
 denied:=false;begin perform public.get_essential_mission_photo_path(c,photo);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee received private photo path';end if;
 perform set_config('request.jwt.claim.sub',foreign_boss::text,true);
 denied:=false;begin perform public.get_essential_mission_photo_path(c,photo);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign manager received private photo path';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 shown:=public.get_essential_mission_photo_path(c,photo);
 if position(c::text in shown->>'path')<>1 then raise exception 'Manager photo path missing tenant isolation';end if;
 shown:=public.list_essential_missions(c,current_date+3,null,true);
 if not exists(select 1 from jsonb_array_elements(shown->'items') x where x->>'completion_photo_id'=photo::text)
 then raise exception 'Manager missing photo proof';end if;
 execute 'reset role';
 if (select count(*) from public.punch_sessions where company_id=c)<>before_punch or
 (select count(*) from public.scheduled_shifts where company_id=c)<>before_shift then
  raise exception 'Photo proof unexpectedly modified payroll time or shifts';end if;
 if has_function_privilege('anon','public.prepare_essential_mission_photo(uuid,uuid,integer)','execute') or
 has_function_privilege('anon','public.get_essential_mission_photo_path(uuid,uuid)','execute') or
 has_function_privilege('authenticated','public.commit_essential_mission_photo_upload(uuid,text,integer)','execute') or
 has_table_privilege('authenticated','private.essential_mission_photos','select') then
  raise exception 'Photo proof exposed to unprivileged role';end if;
end $$;
rollback;
