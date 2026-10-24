begin;
do $$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();colleague uuid:=gen_random_uuid();owner_id uuid;c uuid;l uuid;dept_a uuid;dept_b uuid;w uuid;ann uuid;note_id uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(emp,emp||'@test.invalid',now()),(colleague,colleague||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Communications fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,emp,'employee'),(c,colleague,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=emp;
 select user_id into owner_id from private.platform_owner;perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2')::text,true);perform public.platform_set_essential_test_plan(c,'essential_pro');perform set_config('request.jwt.claim.sub',boss::text,true);
 select id into l from public.essential_locations where company_id=c;dept_a:=public.save_essential_department(c,l,'Production');dept_b:=public.save_essential_department(c,l,'Bureau');perform public.assign_essential_worker(w,l,dept_a);perform public.assign_essential_worker((select id from public.company_workers where company_id=c and auth_user_id=colleague),l,dept_b);
 execute 'set local role authenticated';ann:=public.publish_essential_announcement(c,dept_a,'Consigne importante','Message privé du département',true);
 perform set_config('request.jwt.claim.sub',colleague::text,true);if exists(select 1 from public.essential_announcements where id=ann) then raise exception 'Other department saw announcement';end if;
 denied:=false;begin perform public.acknowledge_essential_announcement(ann);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Other department acknowledged announcement';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);perform public.acknowledge_essential_announcement(ann);perform public.acknowledge_essential_announcement(ann);if (select count(*) from public.essential_announcement_receipts where announcement_id=ann)<>1 then raise exception 'Receipt duplicate';end if;
 note_id:=public.add_essential_shift_note(c,'Passation de quart');
 perform set_config('request.jwt.claim.sub',colleague::text,true);if exists(select 1 from public.essential_shift_notes where id=note_id) then raise exception 'Unrelated worker saw note';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);if not exists(select 1 from public.essential_shift_notes where id=note_id) then raise exception 'Manager cannot see operational note';end if;
 perform public.save_essential_certification(c,w,'Certification proche','certification',current_date-100,current_date+15);
 execute 'reset role';perform private.essential_daily_alerts();perform private.essential_daily_alerts();
 if (select count(*) from public.app_notifications where company_id=c and recipient_id=emp and kind='certification_expiry')<>1 then raise exception 'Expiry alert missing/duplicated';end if;
 if exists(select 1 from public.app_notifications where company_id=c and recipient_id=colleague and kind in ('certification_expiry','announcement')) then raise exception 'Notifications exposed other scope';end if;
end $$;
rollback;
