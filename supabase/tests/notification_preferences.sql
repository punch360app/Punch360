begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid;v integer;denied boolean;n bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a||'@notification.test.invalid',now()),(b,b||'@notification.test.invalid',now());perform set_config('request.jwt.claim.sub',a::text,true);c:=public.create_company_for_edition('Preference fixture','essential');insert into public.company_members(company_id,user_id,role) values(c,b,'employee');
 execute 'set local role authenticated';v:=public.set_notification_preference(c,'decisions',true,false,0);if v<>1 then raise exception 'Initial version';end if;
 denied:=false;begin perform public.set_notification_preference(c,'decisions',false,true,0);exception when others then denied:=true;end;if not denied then raise exception 'Stale version accepted';end if;
 v:=public.set_notification_preference(c,'decisions',false,true,1);if v<>2 then raise exception 'Updated version';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';select count(*) into n from public.notification_preferences where company_id=c;if n<>0 then raise exception 'Other member preferences exposed';end if;
 perform public.set_notification_preference(c,'decisions',true,false,0);execute 'reset role';
 if (select count(*) from public.notification_preferences where company_id=c)<>2 then raise exception 'Personal preferences replaced another user';end if;
 update public.company_members set status='disabled' where company_id=c and user_id=b;execute 'set local role authenticated';denied:=false;begin perform public.set_notification_preference(c,'other',true,true,0);exception when others then denied:=true;end;if not denied then raise exception 'Disabled member changed preferences';end if;execute 'reset role';
end $$;
rollback;
