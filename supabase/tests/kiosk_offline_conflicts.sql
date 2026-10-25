begin;
do $$
declare boss uuid:=gen_random_uuid();c uuid;w uuid:=gen_random_uuid();d uuid:=gen_random_uuid();token text:=repeat('e',64);r jsonb;g uuid;ev jsonb;eid uuid:=gen_random_uuid();ms bigint;msg text;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@offline.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Offline conflict fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_workers(id,company_id,employee_number,first_name,can_kiosk_punch) values(w,c,'OFF-2','Fixture',true);insert into private.worker_pin_secrets(worker_id,pin_hash) values(w,extensions.crypt('829471',extensions.gen_salt('bf',4)));
 insert into private.kiosk_devices(id,company_id,site_id,name,token_hash,pair_expires_at,paired_at,created_by) select d,c,default_punch_job_id,'Conflict kiosk',sha256(convert_to(token,'UTF8')),now()+interval '1 hour',now(),boss from public.companies where id=c;
 r:=public.kiosk_offline_issue(d,token,'OFF-2','829471');g:=(r->'grant'->>'id')::uuid;update private.kiosk_offline_grants set issued_at=now()-interval '2 hours' where id=g;
 ms:=floor(extract(epoch from now()-interval '1 hour')*1000)::bigint;msg:='kiosk-offline-v1|'||d||'|'||g||'|'||eid||'|1|in|'||ms||'|';ev:=jsonb_build_object('id',eid,'grant',g,'sequence',1,'action','in','time',ms,'previous','','proof',encode(extensions.hmac(msg,r->'grant'->>'secret','sha256'),'hex'));perform public.kiosk_offline_receive(d,token,ev);
 execute 'set local role authenticated';denied:=false;begin perform public.set_payroll_week(c,date_trunc('week',now() at time zone 'America/Toronto')::date,true,'Close pending offline');exception when others then denied:=true;end;if not denied then raise exception 'Closed pending offline week';end if;execute 'reset role';
 insert into public.punch_sessions(company_id,worker_id,started_at) values(c,w,now()-interval '30 minutes');
 execute 'set local role authenticated';denied:=false;begin perform public.review_kiosk_offline(g,true,'Concurrent phone change');exception when others then denied:=true;end;if not denied then raise exception 'Concurrent official session overwritten';end if;execute 'reset role';
 if (select count(*) from public.punch_sessions where company_id=c and worker_id=w)<>1 then raise exception 'Conflict review mutated time';end if;
 update private.worker_pin_secrets set updated_at=clock_timestamp()+interval '1 second' where worker_id=w;denied:=false;begin perform public.kiosk_offline_receive(d,token,ev);exception when others then denied:=true;end;if not denied then raise exception 'Reset PIN did not revoke grant';end if;
 execute 'set local role authenticated';perform public.review_kiosk_offline(g,false,'Preserve current official session');execute 'reset role';
 if not exists(select 1 from private.kiosk_offline_events where grant_id=g and state='rejected') then raise exception 'Missing rejection history';end if;
end $$;
rollback;
