-- Offline observations are provisional, never silently official time.
create table private.kiosk_offline_key(singleton boolean primary key default true check(singleton),secret_id uuid not null);
alter table private.kiosk_offline_key enable row level security;revoke all on private.kiosk_offline_key from public,anon,authenticated;
insert into private.kiosk_offline_key(secret_id) select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'punch-kiosk-offline-grants-v1','Offline identity signing key, separate from archives');
create table private.kiosk_offline_grants(
 id uuid primary key default gen_random_uuid(),device_id uuid not null references private.kiosk_devices(id),company_id uuid not null,worker_id uuid not null references public.company_workers(id),job_id uuid not null references public.jobs(id),pin_stamp timestamptz not null,
 issued_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,last_sequence integer not null default 0,last_hash text not null default '',last_time bigint,baseline jsonb,closed_at timestamptz
);
alter table private.kiosk_offline_grants enable row level security;revoke all on private.kiosk_offline_grants from public,anon,authenticated;
create index offline_grants_device on private.kiosk_offline_grants(device_id,issued_at desc);
create table private.kiosk_offline_events(
 id uuid primary key,company_id uuid not null,device_id uuid not null,worker_id uuid not null,grant_id uuid not null references private.kiosk_offline_grants(id),sequence integer not null,
 action text not null,occurred_at timestamptz not null,payload_hash text not null,payload jsonb not null,
 state text not null default 'pending' check(state in('pending','approved','rejected','conflict')),session_id uuid,reviewed_by uuid,reviewed_at timestamptz,review_note text,
 unique(grant_id,sequence)
);
alter table private.kiosk_offline_events enable row level security;revoke all on private.kiosk_offline_events from public,anon,authenticated;
create index offline_events_review on private.kiosk_offline_events(company_id,state,occurred_at);
create function private.kiosk_offline_secret(p_grant uuid,p_device uuid) returns text language sql security definer set search_path='' as $$
 select encode(extensions.hmac(p_grant::text||'|'||p_device::text,d.decrypted_secret,'sha256'),'hex') from private.kiosk_offline_key k join vault.decrypted_secrets d on d.id=k.secret_id
$$;
revoke all on function private.kiosk_offline_secret(uuid,uuid) from public,anon,authenticated;
create function private.kiosk_offline_baseline(c uuid,w uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('session',to_jsonb(s),'segments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.punch_segments x where x.session_id=s.id),'breaks',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.punch_breaks x where x.session_id=s.id)) from public.punch_sessions s where s.company_id=c and s.worker_id=w and s.ended_at is null
$$;
revoke all on function private.kiosk_offline_baseline(uuid,uuid) from public,anon,authenticated;
create function public.kiosk_offline_issue(p_device uuid,p_token text,p_number text,p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare person jsonb;w public.company_workers;g private.kiosk_offline_grants;d private.kiosk_devices;
begin
 person:=public.kiosk_execute(p_device,p_token,p_number,p_pin,'identify');if person->>'ok' is distinct from 'true' then return person;end if;
 select * into d from private.kiosk_devices where id=p_device;
 select * into w from public.company_workers where company_id=d.company_id and employee_number=p_number and status='active' and can_kiosk_punch;
 if w.id is null then raise exception 'Identité invalide';end if;
 insert into private.kiosk_offline_grants(device_id,company_id,worker_id,job_id,pin_stamp,baseline,expires_at) select d.id,d.company_id,w.id,d.site_id,s.updated_at,private.kiosk_offline_baseline(d.company_id,w.id),clock_timestamp()+interval '8 hours' from private.worker_pin_secrets s where s.worker_id=w.id returning * into g;
 return jsonb_build_object('ok',true,'person',person,'grant',jsonb_build_object('id',g.id,'device',d.id,'worker',w.id,'number',p_number,'issued',floor(extract(epoch from g.issued_at)*1000),'expires',floor(extract(epoch from g.expires_at)*1000),'secret',private.kiosk_offline_secret(g.id,d.id)));
end $$;
revoke all on function public.kiosk_offline_issue(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.kiosk_offline_issue(uuid,text,text,text) to service_role;
