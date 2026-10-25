create function public.kiosk_offline_receive(p_device uuid,p_token text,p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;g private.kiosk_offline_grants;old private.kiosk_offline_events;message text;expected text;hash text;event_id uuid;grant_id uuid;seq integer;time_ms bigint;t timestamptz;action text;
begin
 if p_token is null or length(p_token)<>64 then raise exception 'DEVICE_DENIED';end if;
 select * into d from private.kiosk_devices where id=p_device for update;
 if not found or d.revoked_at is not null or d.paired_at is null or d.token_hash is distinct from sha256(convert_to(p_token,'UTF8')) then raise exception 'DEVICE_DENIED';end if;
 if p_event is null or octet_length(p_event::text)>4096 or jsonb_typeof(p_event)<>'object' or exists(select 1 from jsonb_object_keys(p_event) k where k not in('id','grant','sequence','action','time','previous','proof')) then raise exception 'INVALID_EVENT';end if;
 event_id:=(p_event->>'id')::uuid;grant_id:=(p_event->>'grant')::uuid;seq:=(p_event->>'sequence')::integer;time_ms:=(p_event->>'time')::bigint;action:=p_event->>'action';
 if event_id is null or grant_id is null or seq is null or seq not between 1 and 10000 or time_ms is null or abs(time_ms::numeric)>100000000000000 or action is null or action not in('in','out','break_start','break_start_paid','break_end') or coalesce(p_event->>'previous','?') !~ '^([a-f0-9]{64})?$' or coalesce(p_event->>'proof','') !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_EVENT';end if;
 select * into g from private.kiosk_offline_grants where id=grant_id and device_id=d.id and company_id=d.company_id for update;
 if not found or clock_timestamp()>g.expires_at+interval '72 hours' or not exists(select 1 from public.company_workers w join private.worker_pin_secrets s on s.worker_id=w.id where w.id=g.worker_id and w.company_id=g.company_id and w.status='active' and w.can_kiosk_punch and s.updated_at=g.pin_stamp) then raise exception 'GRANT_REVOKED_OR_EXPIRED';end if;
 t:=to_timestamp(time_ms/1000.0);
 if t<g.issued_at-interval '2 minutes' or t>g.expires_at or t>clock_timestamp()+interval '2 minutes' then raise exception 'CLOCK_OR_EXPIRY_CONFLICT';end if;
 message:='kiosk-offline-v1|'||d.id::text||'|'||g.id::text||'|'||event_id::text||'|'||seq::text||'|'||action||'|'||time_ms::text||'|'||(p_event->>'previous');
 expected:=encode(extensions.hmac(message,private.kiosk_offline_secret(g.id,d.id),'sha256'),'hex');
 if extensions.digest(expected,'sha256')<>extensions.digest(p_event->>'proof','sha256') then raise exception 'INVALID_PROOF';end if;
 hash:=encode(extensions.digest(message,'sha256'),'hex');
 select * into old from private.kiosk_offline_events where id=event_id;
 if found then if old.grant_id<>g.id or old.payload_hash<>hash then raise exception 'EVENT_CONFLICT';end if;return jsonb_build_object('ok',true,'id',old.id,'state',old.state,'duplicate',true);end if;
 if g.closed_at is not null then raise exception 'GRANT_ALREADY_REVIEWED';end if;
 if seq<>g.last_sequence+1 or p_event->>'previous'<>g.last_hash or (g.last_time is not null and time_ms<g.last_time) then raise exception 'CHAIN_CONFLICT';end if;
 insert into private.kiosk_offline_events(id,company_id,device_id,worker_id,grant_id,sequence,action,occurred_at,payload_hash,payload) values(event_id,g.company_id,d.id,g.worker_id,g.id,seq,action,t,hash,p_event-'proof');
 update private.kiosk_offline_grants set last_sequence=seq,last_hash=hash,last_time=time_ms where id=g.id;
 insert into private.kiosk_security_audit(company_id,device_id,worker_id,action) values(g.company_id,d.id,g.worker_id,'offline_observation_received');
 return jsonb_build_object('ok',true,'id',event_id,'state','pending');
end $$;
revoke all on function public.kiosk_offline_receive(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.kiosk_offline_receive(uuid,text,jsonb) to service_role;
