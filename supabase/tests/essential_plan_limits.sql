begin;
do $$
declare boss uuid:=gen_random_uuid();owner_id uuid;c uuid;l uuid;p jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Plan limits','essential');update public.companies set billing_status='active',is_test=true,billing_mode='test_simulated',seat_limit=10 where id=c;
 select id into l from public.essential_locations where company_id=c;select user_id into owner_id from private.platform_owner;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2')::text,true);execute 'set local role authenticated';perform public.platform_set_essential_test_plan(c,'essential_plus');
 perform set_config('request.jwt.claim.sub',boss::text,true);
 perform public.save_essential_department(c,l,'Production');
 denied:=false;begin perform public.save_essential_location(c,'Succursale interdite');exception when others then denied:=true;end;if not denied then raise exception 'Plus exceeded one establishment';end if;
 p:=public.create_essential_kiosk_pairing(c,l,'Borne 1');p:=public.create_essential_kiosk_pairing(c,l,'Borne 2');p:=public.create_essential_kiosk_pairing(c,l,'Borne 3');
 denied:=false;begin perform public.create_essential_kiosk_pairing(c,l,'Borne 4 interdite');exception when others then denied:=true;end;if not denied then raise exception 'Plus exceeded three terminals';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform public.platform_set_essential_test_plan(c,'essential_pro');perform set_config('request.jwt.claim.sub',boss::text,true);
 p:=public.create_essential_kiosk_pairing(c,l,'Borne 4 Pro');perform public.save_essential_location(c,'Succursale Pro');
 execute 'reset role';
end $$;
rollback;
