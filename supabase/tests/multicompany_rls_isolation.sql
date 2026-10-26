begin;
do $test$
declare boss_a uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 shared uuid:=gen_random_uuid();worker_b uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 a uuid;b uuid;loc_a uuid;loc_b uuid;wa uuid;wb uuid;w2 uuid;
 sh_a uuid;sh_b uuid;sh_b2 uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss_a,boss_a||'@multitenant-fixture.invalid',clock_timestamp()),
 (boss_b,boss_b||'@multitenant-fixture.invalid',clock_timestamp()),
 (shared,shared||'@multitenant-fixture.invalid',clock_timestamp()),
 (worker_b,worker_b||'@multitenant-fixture.invalid',clock_timestamp()),
 (outsider,outsider||'@multitenant-fixture.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 a:=public.create_company_for_edition('Multientreprise A — test rollback','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 b:=public.create_company_for_edition('Multientreprise B — test rollback','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id in(a,b);
 insert into private.essential_test_plans(company_id,snapshot)
 select c.id,to_jsonb(p) from public.companies c cross join public.essential_plans p
 where c.id in(a,b) and p.id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values
 (a,shared,'employee'),(b,shared,'admin'),(b,worker_b,'employee');
 select id into loc_a from public.essential_locations where company_id=a limit 1;
 select id into loc_b from public.essential_locations where company_id=b limit 1;
 select id into wa from public.company_workers where company_id=a and auth_user_id=shared;
 select id into wb from public.company_workers where company_id=b and auth_user_id=shared;
 select id into w2 from public.company_workers where company_id=b and auth_user_id=worker_b;
 if wa is null or wb is null or wa=wb or w2 is null then raise exception 'Independent worker records not created';end if;
 perform public.assign_essential_worker(wa,loc_a,null);
 perform public.assign_essential_worker(wb,loc_b,null);
 perform public.assign_essential_worker(w2,loc_b,null);
 perform set_config('request.jwt.claim.sub',boss_a::text,true);
 execute 'set local role authenticated';
 sh_a:=public.save_essential_local_shift(a,wa,loc_a,null,'2026-11-09 08:00','2026-11-09 12:00','Fixture compagnie A');
 denied:=false;
 begin perform public.save_essential_local_shift(b,w2,loc_b,null,'2026-11-09 08:00','2026-11-09 12:00','Tentative étrangère');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Foreign boss created shift in company B';end if;
 if (select count(*) from public.companies where id in(a,b))<>1
 or (select count(*) from public.company_workers where company_id=b)<>0
 then raise exception 'Boss A can view company B';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 execute 'set local role authenticated';
 sh_b:=public.save_essential_local_shift(b,wb,loc_b,null,'2026-11-09 08:00','2026-11-09 12:00','Fixture compagnie B');
 sh_b2:=public.save_essential_local_shift(b,w2,loc_b,null,'2026-11-09 13:00','2026-11-09 17:00','Fixture collègue B');
 if (select count(*) from public.scheduled_shifts where company_id=a)<>0
 or (select count(*) from public.scheduled_shifts where company_id=b and id in(sh_b,sh_b2))<>2
 then raise exception 'Boss B has cross-tenant shift access';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',shared::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.company_members where user_id=shared and company_id in(a,b))<>2
 or (select count(*) from public.companies where id in(a,b))<>2
 then raise exception 'Two active memberships not visible to same employee';end if;
 if (select count(*) from public.company_workers where company_id=a and auth_user_id=shared)<>1
 or (select count(*) from public.company_workers where company_id=b and auth_user_id=shared)<>1
 or (select count(*) from public.company_workers where company_id=a and auth_user_id<>shared)<>0
 then raise exception 'Wrong worker access for shared identity';end if;
 if (select count(*) from public.scheduled_shifts where company_id=a and id=sh_a)<>1
 or (select count(*) from public.scheduled_shifts where company_id=b and id in(sh_b,sh_b2))<>2
 then raise exception 'Independent schedule access failed for two-role identity';end if;
 denied:=false;
 begin insert into public.company_members(company_id,user_id,role) values(a,outsider,'boss');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Employee elevated Boss role without permission';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',worker_b::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.companies where id in(a,b))<>1
 or (select count(*) from public.scheduled_shifts where company_id=a)<>0
 or (select count(*) from public.scheduled_shifts where company_id=b and id=sh_b2)<>1
 or (select count(*) from public.scheduled_shifts where company_id=b and id=sh_b)<>0
 then raise exception 'Employee B could see another company or colleague schedule';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.companies where id in(a,b))<>0
 or (select count(*) from public.scheduled_shifts where company_id in(a,b))<>0
 then raise exception 'Nonmember has tenant access';end if;
 execute 'reset role';
end $test$;
rollback;
