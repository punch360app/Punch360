begin;
do $$
declare person uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(person,person||'@test.invalid',now()),(outsider,outsider||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',person::text,true);execute 'set local role authenticated';
 insert into public.essential_appearance(user_id,theme_id) values(person,'carbon');
 update public.essential_appearance set theme_id='pearl' where user_id=person;
 if (select theme_id from public.essential_appearance where user_id=person)<>'pearl' then raise exception 'Own theme not saved';end if;
 denied:=false;begin update public.essential_appearance set theme_id='unknown' where user_id=person;exception when check_violation then denied:=true;end;if not denied then raise exception 'Unknown theme accepted';end if;
 denied:=false;begin insert into public.essential_appearance(user_id,theme_id) values(outsider,'slate');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Theme written for another identity';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.essential_appearance where user_id=person) then raise exception 'Another personal preference leaked';end if;
 update public.essential_appearance set theme_id='linen' where user_id=person;
 execute 'reset role';if (select theme_id from public.essential_appearance where user_id=person)<>'pearl' then raise exception 'Another user changed theme';end if;
end $$;
rollback;
