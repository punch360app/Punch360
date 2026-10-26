begin;
do $t$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();sess uuid:=gen_random_uuid();
 c uuid;loc uuid;worker uuid;sh uuid;tok1 text;tok2 text;payload jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@ics-fixture.invalid',clock_timestamp()),(emp,emp||'@ics-fixture.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Private calendar rollback test','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,emp,'employee');
 select id into worker from public.company_workers where company_id=c and auth_user_id=emp;
 select id into loc from public.essential_locations where company_id=c;
 update public.company_workers set status='active',personal_access=true where id=worker;
 perform public.assign_essential_worker(worker,loc,null);
 sh:=public.save_essential_local_shift(c,worker,loc,null,'2026-11-17 09:00','2026-11-17 13:00','TEST PRIVATE');
 insert into auth.sessions(id,user_id,aal,not_after) values(sess,emp,'aal1',clock_timestamp()+interval '30 minutes');
 perform set_config('request.jwt.claim.sub',emp::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',emp,'session_id',sess,'aal','aal1')::text,true);
 execute 'set local role authenticated';
 payload:=public.personal_calendar_feed_status(c);
 if (payload->>'active')::boolean then raise exception 'Unexpected preexisting feed';end if;
 payload:=public.personal_calendar_feed_rotate(c);tok1:=payload->>'token';
 if length(tok1)<>64 then raise exception 'Token not 256 bits';end if;
 denied:=false;begin perform public.personal_calendar_feed_read(tok1);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Authenticated user could read service-only token feed';end if;
 execute 'reset role';
 if exists(select 1 from private.essential_calendar_feed_tokens where company_id=c and token_hash=convert_to(tok1,'UTF8'))
 then raise exception 'Plain token stored in database';end if;
 execute 'set local role service_role';
 payload:=public.personal_calendar_feed_read(tok1);
 if payload->>'company_id'<>c::text or jsonb_array_length(payload->'shifts')<>1
   or payload->'shifts'->0->>'worker_id'<>worker::text
 then raise exception 'Personal feed missing/incorrect %',payload;end if;
 execute 'reset role';
 execute 'set local role authenticated';
 payload:=public.personal_calendar_feed_rotate(c);tok2:=payload->>'token';
 if tok2=tok1 then raise exception 'Rotated token unchanged';end if;
 execute 'set local role service_role';
 if public.personal_calendar_feed_read(tok1) is not null then raise exception 'Old link survived rotation';end if;
 if public.personal_calendar_feed_read(tok2) is null then raise exception 'New link not readable';end if;
 execute 'reset role';
 update public.company_members set role='lead' where company_id=c and user_id=emp;
 execute 'set local role service_role';
 if public.personal_calendar_feed_read(tok2) is not null then raise exception 'Changed role did not revoke subscription';end if;
 execute 'reset role';
 execute 'set local role authenticated';
 payload:=public.personal_calendar_feed_rotate(c);tok2:=payload->>'token';
 payload:=public.personal_calendar_feed_revoke(c);
 if not (payload->>'revoked')::boolean then raise exception 'Failed explicit revocation';end if;
 execute 'set local role service_role';
 if public.personal_calendar_feed_read(tok2) is not null then raise exception 'Explicitly revoked feed still active';end if;
 execute 'reset role';
 if (select count(*) from private.essential_calendar_feed_tokens where company_id=c and revoked_at is null)<>0
 then raise exception 'Active feed survives revocation';end if;
end $t$;
rollback;
