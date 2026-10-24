begin;
do $$
declare boss uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();c uuid;l uuid;p jsonb;device uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(other_user,other_user||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('PWA device regression','essential');select id into l from public.essential_locations where company_id=c;
 execute 'set local role authenticated';p:=public.create_essential_kiosk_pairing(c,l,'Réception');device:=(p->>'device_id')::uuid;
 if (public.list_kiosk_devices(c)->0->>'idle_seconds')::integer<>10 then raise exception 'Default timeout not 10s';end if;
 perform public.set_kiosk_idle(device,30);if (public.list_kiosk_devices(c)->0->>'idle_seconds')::integer<>30 then raise exception 'Timeout not saved';end if;
 denied:=false;begin perform public.set_kiosk_idle(device,600);exception when others then denied:=true;end;if not denied then raise exception 'Invalid delay accepted';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);denied:=false;begin perform public.set_kiosk_idle(device,60);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Other tenant changed device';end if;
 execute 'reset role';p:=public.kiosk_pair_device(p->>'pairing_code');if (p->>'idle_seconds')::integer<>30 then raise exception 'Device did not receive timeout';end if;
end $$;
rollback;
