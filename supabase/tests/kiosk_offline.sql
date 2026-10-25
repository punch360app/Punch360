-- Fictional company, device and worker only. All writes are rolled back.
begin;
do $$
declare boss uuid:=gen_random_uuid();c uuid;w uuid:=gen_random_uuid();d uuid:=gen_random_uuid();token text:=repeat('d',64);r jsonb;g uuid;event jsonb;event_id uuid;actions text[]:=array['in','break_start','break_end','out'];i integer;ms bigint;msg text;prev text:='';proof text;denied boolean;n bigint;sid uuid;reviewed jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@offline.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Offline fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_workers(id,company_id,employee_number,first_name,can_kiosk_punch,can_mobile_punch,personal_access) values(w,c,'OFF-1','Offline fixture',true,false,false);
 insert into private.worker_pin_secrets(worker_id,pin_hash) values(w,extensions.crypt('829471',extensions.gen_salt('bf',4)));
 insert into private.kiosk_devices(id,company_id,site_id,name,token_hash,pair_expires_at,paired_at,created_by) select d,c,default_punch_job_id,'Fixture kiosk',sha256(convert_to(token,'UTF8')),now()+interval '1 hour',now(),boss from public.companies where id=c;
 execute 'set local role authenticated';denied:=false;begin perform public.kiosk_offline_issue(d,token,'OFF-1','829471');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Browser can bypass service identity check';end if;execute 'reset role';
 r:=public.kiosk_offline_issue(d,token,'OFF-1','829471');if r->>'ok'<>'true' then raise exception 'Offline grant not issued';end if;g:=(r->'grant'->>'id')::uuid;
 update private.kiosk_offline_grants set issued_at=now()-interval '2 hours',expires_at=now()+interval '6 hours' where id=g;
 for i in 1..4 loop
  event_id:=gen_random_uuid();ms:=floor(extract(epoch from now()-interval '2 hours'+i*interval '20 minutes')*1000)::bigint;
  msg:='kiosk-offline-v1|'||d||'|'||g||'|'||event_id||'|'||i||'|'||actions[i]||'|'||ms||'|'||prev;
  proof:=encode(extensions.hmac(msg,r->'grant'->>'secret','sha256'),'hex');event:=jsonb_build_object('id',event_id,'grant',g,'sequence',i,'action',actions[i],'time',ms,'previous',prev,'proof',proof);
  perform public.kiosk_offline_receive(d,token,event);perform public.kiosk_offline_receive(d,token,event);
  denied:=false;begin perform public.kiosk_offline_receive(d,token,event||jsonb_build_object('proof',repeat('0',64)));exception when others then denied:=true;end;if not denied then raise exception 'Forged proof accepted';end if;
  prev:=encode(extensions.digest(msg,'sha256'),'hex');
  if i=1 then execute 'set local role authenticated';denied:=false;begin perform public.review_kiosk_offline(g,true,'Incomplete fixture');exception when others then denied:=true;end;if not denied then raise exception 'Open day approved';end if;execute 'reset role';if exists(select 1 from public.punch_sessions where company_id=c and worker_id=w) then raise exception 'Failed review left hours';end if;end if;
 end loop;
 if exists(select 1 from public.punch_sessions where company_id=c and worker_id=w) then raise exception 'Replay mutated official hours before approval';end if;
 execute 'set local role authenticated';reviewed:=public.review_kiosk_offline(g,true,'Verified fixture observations');if public.review_kiosk_offline(g,true,'Verified fixture observations') is distinct from reviewed then raise exception 'Review retry differs';end if;execute 'reset role';
 select id into sid from public.punch_sessions where company_id=c and worker_id=w and ended_at is not null;if sid is null then raise exception 'Official closed day not reconciled';end if;
 if (select count(*) from public.punch_breaks where session_id=sid and ended_at is not null)<>1 or (select count(*) from private.kiosk_offline_events where grant_id=g and state='approved')<>4 then raise exception 'Lost pause or duplicate replay';end if;
 perform public.kiosk_offline_receive(d,token,event);
 update private.kiosk_devices set revoked_at=clock_timestamp() where id=d;denied:=false;begin perform public.kiosk_offline_receive(d,token,event);exception when others then denied:=true;end;if not denied then raise exception 'Revoked device accepted';end if;
end $$;
rollback;
