-- Synthetic fixtures only, all changes are rolled back. Storage files are never touched.
begin;
do $test$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();c uuid;w uuid;
 client uuid;site uuid;m1 uuid;m2 uuid;m3 uuid;f1 uuid;f2 uuid;f3 uuid;
 result jsonb;claims jsonb;token1 uuid;token2 uuid;wrong uuid:=gen_random_uuid();
begin
 if has_function_privilege('authenticated','public.claim_expired_mission_photos(integer)','execute')
 or has_function_privilege('anon','public.finish_expired_mission_photo(uuid,uuid,boolean)','execute')
 or has_function_privilege('authenticated','public.mission_photo_retention_authorized(text)','execute')
 then raise exception 'Cleanup RPC exposed to client role';end if;
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@retention.test.invalid',now()),(emp,emp||'@retention.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Retention synthetic','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20 where id=c;
 insert into public.company_members(company_id,user_id,role,status) values(c,emp,'employee','active');
 select id into w from public.company_workers where company_id=c and auth_user_id=emp;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(c,null,0,'Cleanup test','','','',true);
 client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(c,null,0,client,'Site synthétique',
 '10 rue des Tests','','Québec','QC','G1K 1A1','CA','America/Toronto',
 null,null,'','','','No secrets',true);
 site:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(c,true);
 result:=public.save_essential_mission(c,null,0,w,site,current_date+3,1,'Pending expired','',true);
 m1:=(result->>'id')::uuid;
 result:=public.save_essential_mission(c,null,0,w,site,current_date+3,2,'Linked expired','',true);
 m2:=(result->>'id')::uuid;
 result:=public.save_essential_mission(c,null,0,w,site,current_date+3,3,'Future pending','',true);
 m3:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 f1:=(public.prepare_essential_mission_photo(c,m1,1)->>'photo_id')::uuid;
 f2:=(public.prepare_essential_mission_photo(c,m2,1)->>'photo_id')::uuid;
 f3:=(public.prepare_essential_mission_photo(c,m3,1)->>'photo_id')::uuid;
 execute 'set local role service_role';
 perform public.commit_essential_mission_photo_upload(f2,'image/png',120);
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.complete_essential_mission_v4(c,m2,1,gen_random_uuid(),null,null,f2);
 if result->>'photo_saved'<>'true' then raise exception 'Fixture photo not linked';end if;
 execute 'reset role';
 update private.essential_mission_photos set expires_at=now()-interval '2 minutes' where id=f1;
 update private.essential_mission_photos set retention_until=now()-interval '2 minutes' where id=f2;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',emp::text,true);
 if has_function_privilege('authenticated','public.claim_expired_mission_photos(integer)','execute')
 then raise exception 'Employee gained cleanup permission';end if;
 execute 'set local role service_role';
 if public.mission_photo_retention_authorized(repeat('0',64))
 then raise exception 'Unknown cron bearer accepted';end if;
 claims:=public.claim_expired_mission_photos(25);
 if jsonb_array_length(claims)<>2 then raise exception 'Wrong expired set: %',claims;end if;
 select (x->>'claim')::uuid into token1 from jsonb_array_elements(claims) x where x->>'id'=f1::text;
 select (x->>'claim')::uuid into token2 from jsonb_array_elements(claims) x where x->>'id'=f2::text;
 if token1 is null or token2 is null then raise exception 'Missing expired claims';end if;
 if jsonb_array_length(public.claim_expired_mission_photos(25))<>0 then
 raise exception 'Active claim issued twice';end if;
 if public.finish_expired_mission_photo(f1,wrong,true) then
 raise exception 'Invalid claim removed a photo';end if;
 if public.finish_expired_mission_photo(f1,token1,false) then
 raise exception 'Storage deletion failure marked success';end if;
 if not exists(select 1 from private.essential_mission_photos where id=f1)
 then raise exception 'Failure removed metadata';end if;
 if not public.finish_expired_mission_photo(f2,token2,true)
 then raise exception 'Expired linked photo did not finalize';end if;
 if exists(select 1 from private.essential_mission_photos where id=f2)
 then raise exception 'Linked expired metadata persists';end if;
 if (select completion_photo_id from private.essential_missions where id=m2) is not null
 then raise exception 'Mission retains deleted proof';end if;
 claims:=public.claim_expired_mission_photos(25);
 if jsonb_array_length(claims)<>1 or claims->0->>'id'<>f1::text
 then raise exception 'Failure not eligible for retry: %',claims;end if;
 if not public.finish_expired_mission_photo(f1,(claims->0->>'claim')::uuid,true)
 then raise exception 'Pending proof not removed';end if;
 if not exists(select 1 from private.essential_mission_photos where id=f3)
 then raise exception 'Unexpired photo removed';end if;
 if jsonb_array_length(public.claim_expired_mission_photos(25))<>0
 then raise exception 'Queue not empty after cleanup';end if;
 execute 'reset role';
end $test$;
rollback;
