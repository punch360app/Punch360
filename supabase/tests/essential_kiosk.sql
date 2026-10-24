begin;
do $$
declare boss uuid:=gen_random_uuid();u uuid:=gen_random_uuid();c uuid;w public.company_workers;code jsonb;device jsonb;enroll text;r jsonb;invite jsonb;sid uuid;ev uuid:=gen_random_uuid();denied boolean;other uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(u,u||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Kiosk acceptance','essential');update public.companies set billing_status='active',seat_limit=5 where id=c;
 execute 'set local role authenticated';w:=public.create_essential_worker(c,'AB-0248','Alexandre','Martin',u||'@test.invalid');
 perform public.set_essential_worker_channels(w.id,true,true,true,'Mode mixte');
 code:=public.create_kiosk_pairing(c,'Réception');enroll:=public.create_pin_enrollment(w.id);
 denied:=false;begin perform public.kiosk_pair_device(code->>'pairing_code');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Authenticated user can use service-only kiosk API';end if;
 execute 'reset role';
 device:=public.kiosk_pair_device(code->>'pairing_code');if device->>'ok'<>'true' then raise exception 'Pairing failed';end if;
 r:=public.kiosk_pair_device(code->>'pairing_code');if r->>'ok'='true' then raise exception 'Pairing replay';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','enroll',null,enroll);
 if r->>'ok'<>'true' then raise exception 'PIN enrollment failed';end if;
 if (select pin_hash from private.worker_pin_secrets where worker_id=w.id)='829471' then raise exception 'Plaintext PIN';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','in',ev);
 if r->>'ok'<>'true' then raise exception 'Kiosk IN failed: %',r;end if;sid:=(r->>'session_id')::uuid;
 if (select user_id from public.punch_sessions where id=sid) is not null then raise exception 'No-auth worker fabricated an auth user';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','in',ev);
 if (r->>'session_id')::uuid<>sid then raise exception 'Event replay not idempotent';end if;
 if (select count(*) from public.punch_sessions where worker_id=w.id)<>1 then raise exception 'Duplicate kiosk session';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','break_start_paid',gen_random_uuid());if r->>'ok'<>'true' then raise exception 'Paid kiosk break failed %',r;end if;if not exists(select 1 from public.punch_breaks where session_id=sid and is_paid and ended_at is null) then raise exception 'Paid kiosk classification missing';end if;r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','break_end',gen_random_uuid());
 -- Activate personal account while kiosk session is open: retain exactly same worker + session.
 perform set_config('request.jwt.claim.sub',boss::text,true);execute 'set local role authenticated';invite:=public.create_worker_invitation(w.id);
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.accept_worker_invitation(invite->>'token');
 if (select id from public.punch_sessions where user_id=u and ended_at is null)<>sid then raise exception 'Historical kiosk session missing after activation';end if;
 r:=public.sync_break_event(gen_random_uuid(),c,'break_start',clock_timestamp(),false);
 execute 'reset role';
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','identify');if r->>'paused'<>'true' then raise exception 'Mobile pause not visible on kiosk';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','break_end',gen_random_uuid());if r->>'ok'<>'true' then raise exception 'Cross-device resume failed';end if;
 execute 'set local role authenticated';r:=public.punch_with_location(c,'out');execute 'reset role';
 if (select ended_at from public.punch_sessions where id=sid) is null then raise exception 'Mobile OUT did not close kiosk session';end if;
 execute 'set local role authenticated';r:=public.punch_with_location(c,'in',(select default_punch_job_id from public.companies where id=c));execute 'reset role';
 -- Existing workers keep kiosk punch after management restriction.
 update public.companies set billing_status='restricted' where id=c;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','out',gen_random_uuid());if r->>'ok'<>'true' then raise exception 'Kiosk OUT blocked by unpaid billing';end if;
 -- Persist failure counters and lock after 5 wrong attempts without throwing/rolling them back.
 for n in 1..5 loop r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','000001','identify');end loop;
 if (select failed_attempts from private.kiosk_devices where id=(device->>'device_id')::uuid)<>5 then raise exception 'PIN failure counters not durable';end if;
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','identify');if r->>'ok'='true' then raise exception 'Device lockout bypassed';end if;
 update public.companies set billing_status='active' where id=c;
 perform set_config('request.jwt.claim.sub',boss::text,true);execute 'set local role authenticated';perform public.revoke_kiosk((device->>'device_id')::uuid,'Perte de la tablette');execute 'reset role';
 r:=public.kiosk_execute((device->>'device_id')::uuid,device->>'token','AB-0248','829471','identify');if r->>'ok'='true' then raise exception 'Revoked device accepted';end if;
end $$;
rollback;
