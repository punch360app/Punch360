begin;
do $$
declare boss uuid:=gen_random_uuid();recipient uuid:=gen_random_uuid();c uuid;w public.company_workers;i uuid;mail jsonb;item jsonb;denied boolean;claimed jsonb;
begin
 if exists(select 1 from private.worker_invitation_email) then raise exception 'Run synthetic worker test with empty email queue or isolated clone';end if;
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@mail.test.invalid',now()),(recipient,recipient||'@mail.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Email invitation fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 execute 'set local role authenticated';perform public.set_invitation_delivery_settings(c,true,24,0);w:=public.create_essential_worker(c,'EMAIL-1','Synthetic','Recipient',recipient||'@mail.test.invalid');execute 'reset role';
 select id into i from private.worker_invitations where worker_id=w.id and revoked_at is null;
 if i is null or not exists(select 1 from private.worker_invitation_email where invitation_id=i and encrypted_token is not null) then raise exception 'New worker email not queued';end if;
 if (select expires_at-created_at from private.worker_invitations where id=i)>interval '24 hours 1 second' then raise exception 'Expiry setting not applied';end if;
 execute 'set local role authenticated';denied:=false;begin perform public.claim_invitation_email();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client claimed email secrets';end if;execute 'reset role';
 execute 'set local role service_role';claimed:=public.claim_invitation_email();if jsonb_array_length(claimed)<>1 then raise exception 'Email claim size';end if;item:=claimed->0;execute 'reset role';
 if (select token_hash from private.worker_invitations where id=i)<>sha256(convert_to(item->>'token','UTF8')) then raise exception 'Encrypted token mismatch';end if;
 execute 'set local role service_role';if jsonb_array_length(public.claim_invitation_email())<>0 then raise exception 'Double email lease';end if;
 -- Webhook can arrive before the send result is committed.
 perform public.invitation_email_event('synthetic-event-1','synthetic-provider','email.delivered');perform public.finish_invitation_email(i,(item->>'lease')::uuid,'sent','synthetic-provider');execute 'reset role';
 if (select status from private.worker_invitation_email where invitation_id=i)<>'delivered' or exists(select 1 from private.worker_invitation_email where invitation_id=i and encrypted_token is not null) then raise exception 'Delivery event race or token purge failed';end if;
 execute 'set local role service_role';perform public.invitation_email_event('synthetic-event-1','synthetic-provider','email.delivered');execute 'reset role';if (select count(*) from private.invitation_email_events where event_id='synthetic-event-1')<>1 then raise exception 'Duplicate webhook stored';end if;
 mail:=public.create_worker_invitation(w.id);i:=(mail->>'id')::uuid;perform public.set_invitation_delivery_settings(c,false,24,1);execute 'set local role service_role';if jsonb_array_length(public.claim_invitation_email())<>0 then raise exception 'Disabled automation still sends';end if;execute 'reset role';if (select status from private.worker_invitation_email where invitation_id=i)<>'cancelled' then raise exception 'Disabled queue not cancelled';end if;
end $$;
rollback;
