begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();c uuid;device uuid;n uuid;claimed jsonb;lease uuid;item uuid;denied boolean;
begin
 if exists(select 1 from private.push_outbox) then raise exception 'Run this synthetic worker test only with an empty queue or isolated clone';end if;
 insert into auth.users(id,email,email_confirmed_at) values(a,a||'@push.test.invalid',now()),(b,b||'@push.test.invalid',now());insert into auth.sessions(id,user_id,aal,not_after) values(sid,a,'aal1',clock_timestamp()+interval '1 hour');perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sid)::text,true);
 c:=public.create_company_for_edition('Push delivery fixture','essential');insert into public.company_members(company_id,user_id,role) values(c,b,'employee');
 execute 'set local role authenticated';device:=public.register_push_device(c,'ExpoPushToken[synthetic-fixture-token]','android');if public.list_push_devices(c)::text like '%synthetic-fixture-token%' then raise exception 'Token exposed to client';end if;
 denied:=false;begin perform public.claim_push_delivery();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client claimed service delivery';end if;
 perform public.set_notification_preference(c,'decisions',true,false,0);execute 'reset role';
 insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(c,a,'leave_requests_decision','Fixture','Never sent') returning id into n;
 if (select count(*) from private.push_outbox where notification_id=n)<>1 then raise exception 'Missing opted in push';end if;
 execute 'set local role service_role';claimed:=public.claim_push_delivery();if jsonb_array_length(claimed)<>1 then raise exception 'Claim size incorrect';end if;item:=(claimed->0->>'id')::uuid;lease:=(claimed->0->>'lease')::uuid;
 if jsonb_array_length(public.claim_push_delivery())<>0 then raise exception 'Concurrent lease duplicate';end if;
 perform public.finish_push_delivery(item,lease,'accepted','synthetic-ticket');execute 'reset role';if (select status from private.push_outbox where id=item)<>'accepted' then raise exception 'Ticket treated as delivery';end if;
 update private.push_outbox set available_at=clock_timestamp()-interval '1 second' where id=item;execute 'set local role service_role';claimed:=public.claim_push_delivery();if claimed->0->>'ticket_id'<>'synthetic-ticket' then raise exception 'Receipt ticket lost';end if;perform public.finish_push_delivery(item,(claimed->0->>'lease')::uuid,'failed',null,'DeviceNotRegistered');execute 'reset role';
 if (select revoked_at from private.push_devices where id=device) is null then raise exception 'Invalid device not revoked';end if;
 perform public.register_push_device(c,'ExpoPushToken[synthetic-fixture-token]','android');insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(c,a,'leave_requests_decision','Fixture','Optout test') returning id into n;
 perform public.set_notification_preference(c,'decisions',false,false,1);execute 'set local role service_role';if jsonb_array_length(public.claim_push_delivery())<>0 then raise exception 'Optout not respected';end if;execute 'reset role';if (select status from private.push_outbox where notification_id=n)<>'cancelled' then raise exception 'Optout pending not cancelled';end if;
 update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id=sid;denied:=false;begin perform public.register_push_device(c,'ExpoPushToken[synthetic-fixture-token]','android');exception when others then denied:=true;end;if not denied then raise exception 'Expired session registered device';end if;
 update public.company_members set status='disabled' where company_id=c and user_id=a;if (select revoked_at from private.push_devices where id=device) is null then raise exception 'Disabled member device not revoked';end if;
end $$;
rollback;
