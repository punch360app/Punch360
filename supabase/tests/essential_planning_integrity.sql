begin;
do $$
declare boss uuid:=gen_random_uuid();u uuid:=gen_random_uuid();c uuid;l uuid;w uuid;s1 uuid;s2 uuid;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(u,u||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Timezone acceptance','essential');update public.companies set billing_status='active',seat_limit=5 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,u,'employee');select id into l from public.essential_locations where company_id=c;select id into w from public.company_workers where company_id=c and auth_user_id=u;
 execute 'set local role authenticated';
 s1:=public.save_essential_local_shift(c,w,l,null,'2026-10-31 23:00','2026-11-01 07:00','Nuit de retour à l’heure normale');
 if (select extract(epoch from ends_at-starts_at)/3600 from public.scheduled_shifts where id=s1)<>9 then raise exception 'Fall overnight duration incorrect';end if;
 s2:=public.save_essential_local_shift(c,w,l,null,'2026-03-07 23:00','2026-03-08 07:00','Nuit de passage à l’heure avancée');
 if (select extract(epoch from ends_at-starts_at)/3600 from public.scheduled_shifts where id=s2)<>7 then raise exception 'Spring overnight duration incorrect';end if;
 perform public.save_essential_local_shift(c,w,l,null,'2026-10-31 22:00','2026-11-01 07:00','Mise à jour',s1,1);
 denied:=false;begin perform public.save_essential_local_shift(c,w,l,null,'2026-10-31 21:00','2026-11-01 07:00','Édition périmée',s1,1);exception when others then denied:=true;end;if not denied then raise exception 'Stale version accepted';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.acknowledge_essential_shift(s1,2);
 denied:=false;begin update public.scheduled_shifts set note='Bypass RPC' where id=s1;exception when insufficient_privilege then denied:=true;end;
 if not denied and exists(select 1 from public.scheduled_shifts where id=s1 and note='Bypass RPC') then raise exception 'Direct client mutation bypasses workflow';end if;
 execute 'reset role';update public.company_members set status='disabled' where company_id=c and user_id=u;
 perform set_config('request.jwt.claim.sub',boss::text,true);execute 'set local role authenticated';perform public.cancel_essential_shift(s1,2,'Salarié désactivé : retirer le quart futur');
 if (select cancelled_at from public.scheduled_shifts where id=s1) is null then raise exception 'Cannot cancel a disabled worker future shift';end if;
 execute 'reset role';
end $$;
rollback;
