-- Shared ledger: worker identity is independent of optional Auth identity.
alter table public.punch_sessions alter column user_id drop not null;
alter table public.punch_sessions add column worker_id uuid;
alter table public.punch_sessions add foreign key(company_id,worker_id) references public.company_workers(company_id,id);
update public.punch_sessions s set worker_id=w.id from public.company_workers w where w.company_id=s.company_id and w.auth_user_id=s.user_id;
create unique index one_open_session_per_stable_worker on public.punch_sessions(company_id,worker_id) where ended_at is null and worker_id is not null;
alter table public.punch_breaks alter column user_id drop not null;
create function private.bind_session_worker() returns trigger language plpgsql security definer set search_path='' as $$
declare w public.company_workers;
begin
 if exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then
  select * into w from public.company_workers where company_id=new.company_id and ((new.worker_id is not null and id=new.worker_id) or (new.worker_id is null and auth_user_id=new.user_id));
  if not found or w.status<>'active' or w.auth_user_id is distinct from new.user_id then raise exception 'Identité salariée invalide';end if;
  new.worker_id:=w.id;
 elsif new.worker_id is not null then raise exception 'Identité Essentiel sur une session Construction';end if;
 return new;
end $$;
revoke all on function private.bind_session_worker() from public,anon,authenticated;
create trigger bind_session_worker before insert or update of worker_id,user_id,company_id on public.punch_sessions for each row execute function private.bind_session_worker();
-- Activation attaches the historical kiosk rows AFTER membership exists; same worker/session IDs.
do $$
declare d text;changed text;
begin
 select pg_get_functiondef('public.accept_worker_invitation(text)'::regprocedure) into d;
 changed:=replace(d,'update private.worker_invitations set accepted_at=',E'update public.punch_sessions set user_id=auth.uid() where company_id=w.company_id and worker_id=w.id and user_id is null;\n update public.punch_breaks set user_id=auth.uid() where company_id=w.company_id and user_id is null and session_id in(select id from public.punch_sessions where company_id=w.company_id and worker_id=w.id);\n update private.worker_invitations set accepted_at=');
 if changed=d then raise exception 'Activation source changed';end if;execute changed;
end $$;
create table private.kiosk_devices (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),site_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 80),pair_hash bytea,token_hash bytea,
 pair_expires_at timestamptz not null,paired_at timestamptz,revoked_at timestamptz,last_seen_at timestamptz,
 failed_attempts integer not null default 0,locked_until timestamptz,created_by uuid not null,
 foreign key(company_id,site_id) references public.jobs(company_id,id)
);
alter table private.kiosk_devices enable row level security;
revoke all on private.kiosk_devices from public,anon,authenticated;
create table private.worker_pin_secrets (
 worker_id uuid primary key references public.company_workers(id),pin_hash text,
 enrollment_hash bytea,enrollment_expires_at timestamptz,failed_attempts integer not null default 0,locked_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table private.worker_pin_secrets enable row level security;
revoke all on private.worker_pin_secrets from public,anon,authenticated;
create table private.kiosk_events (
 event_id uuid primary key,company_id uuid not null,device_id uuid not null references private.kiosk_devices(id),
 worker_id uuid not null references public.company_workers(id),action text not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.kiosk_events enable row level security;
revoke all on private.kiosk_events from public,anon,authenticated;
create table private.kiosk_security_audit (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,device_id uuid,
 worker_id uuid,action text not null,created_at timestamptz not null default clock_timestamp()
);
alter table private.kiosk_security_audit enable row level security;
revoke all on private.kiosk_security_audit from public,anon,authenticated;
create function public.create_kiosk_pairing(p_company uuid,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.companies;id uuid;token text;lim integer;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 select * into c from public.companies where companies.id=p_company for update;
 if c.product_edition<>'essential' or c.default_punch_job_id is null then raise exception 'Établissement Essentiel requis';end if;
 select (pricing_snapshot->>'kiosk_limit')::integer into lim from private.essential_contracts where company_id=c.id order by created_at desc limit 1;
 if not found then select kiosk_limit into lim from public.essential_plans where essential_plans.id='essential';end if;
 if lim is not null and (select count(*) from private.kiosk_devices where company_id=c.id and revoked_at is null and (paired_at is not null or pair_expires_at>clock_timestamp()))>=lim then raise exception 'Limite de bornes atteinte';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.kiosk_devices(company_id,site_id,name,pair_hash,pair_expires_at,created_by) values(c.id,c.default_punch_job_id,trim(p_name),sha256(convert_to(token,'UTF8')),clock_timestamp()+interval '10 minutes',auth.uid()) returning kiosk_devices.id into id;
 return jsonb_build_object('device_id',id,'pairing_code',id::text||'.'||token,'expires_in_minutes',10);
end $$;
create function public.list_kiosk_devices(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_manager(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'site_id',d.site_id,'paired_at',d.paired_at,'revoked_at',d.revoked_at,'last_seen_at',d.last_seen_at)) from private.kiosk_devices d where company_id=p_company),'[]'::jsonb);
end $$;
create function public.revoke_kiosk(p_device uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;
begin
 select * into d from private.kiosk_devices where id=p_device for update;
 if not found or not private.can_administer(d.company_id) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Motif requis';end if;
 update private.kiosk_devices set revoked_at=clock_timestamp(),token_hash=null,pair_hash=null where id=d.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(d.company_id,auth.uid(),'kiosk_revoked',d.id,trim(p_reason));
end $$;
create function public.create_pin_enrollment(p_worker uuid) returns text language plpgsql security definer set search_path='' as $$
declare w public.company_workers;token text;
begin
 select * into w from public.company_workers where id=p_worker;
 if not found or not private.can_administer(w.company_id) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if not w.can_kiosk_punch or w.role='admin' or w.status<>'active' then raise exception 'Activer le pointage tablette pour ce salarié';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.worker_pin_secrets(worker_id,enrollment_hash,enrollment_expires_at) values(w.id,sha256(convert_to(token,'UTF8')),clock_timestamp()+interval '15 minutes')
 on conflict(worker_id) do update set enrollment_hash=excluded.enrollment_hash,enrollment_expires_at=excluded.enrollment_expires_at;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(w.company_id,auth.uid(),'pin_enrollment_requested',w.id,'Code à remettre en personne au salarié vérifié');
 return token;
end $$;
-- Service endpoints, never callable with a general client key or a user's JWT.
create function public.kiosk_pair_device(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;id uuid;token text;
begin
 if p_code is null or p_code !~ '^[0-9a-f-]{36}\.[0-9a-f]{64}$' then return jsonb_build_object('ok',false);end if;
 id:=split_part(p_code,'.',1)::uuid;
 select * into d from private.kiosk_devices where kiosk_devices.id=id for update;
 if not found or d.revoked_at is not null or d.paired_at is not null or d.pair_expires_at<=clock_timestamp() or d.pair_hash is distinct from sha256(convert_to(split_part(p_code,'.',2),'UTF8')) then return jsonb_build_object('ok',false);end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update private.kiosk_devices set paired_at=clock_timestamp(),pair_hash=null,token_hash=sha256(convert_to(token,'UTF8')),last_seen_at=clock_timestamp() where kiosk_devices.id=id;
 return jsonb_build_object('ok',true,'device_id',id,'token',token,'name',d.name,'company_name',(select name from public.companies where companies.id=d.company_id));
end $$;
create function public.kiosk_execute(p_device uuid,p_token text,p_number text,p_pin text,p_action text,p_event uuid default null,p_enrollment text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;w public.company_workers;secret private.worker_pin_secrets;s public.punch_sessions;
 prior private.kiosk_events;now_at timestamptz:=clock_timestamp();result jsonb;session_id uuid;paused boolean;
begin
 if p_token is null or length(p_token)<>64 or p_action is null or p_action not in ('identify','enroll','in','out','break_start','break_end') then return jsonb_build_object('ok',false);end if;
 select * into d from private.kiosk_devices where id=p_device for update;
 if not found or d.paired_at is null or d.revoked_at is not null or d.token_hash is distinct from sha256(convert_to(p_token,'UTF8')) then return jsonb_build_object('ok',false,'error','DEVICE_DENIED');end if;
 if d.locked_until>now_at then return jsonb_build_object('ok',false,'error','TRY_LATER');end if;
 update private.kiosk_devices set last_seen_at=now_at where id=d.id;
 select * into w from public.company_workers where company_id=d.company_id and employee_number=p_number and status='active' and role in ('employee','lead','boss') and can_kiosk_punch;
 if found then select * into secret from private.worker_pin_secrets where worker_id=w.id for update;end if;
 if p_action='enroll' and w.id is not null and p_enrollment is not null and secret.enrollment_hash=sha256(convert_to(p_enrollment,'UTF8')) and secret.enrollment_expires_at>now_at then
  if p_pin is null or p_pin !~ '^[0-9]{6,12}$' or p_pin in ('000000','111111','123456','654321') then return jsonb_build_object('ok',false,'error','PIN_POLICY');end if;
  update private.worker_pin_secrets set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),enrollment_hash=null,enrollment_expires_at=null,failed_attempts=0,locked_until=null,updated_at=now_at where worker_id=w.id;
  insert into private.kiosk_security_audit(company_id,device_id,worker_id,action) values(d.company_id,d.id,w.id,'pin_enrolled');
  return jsonb_build_object('ok',true,'enrolled',true);
 end if;
 if w.id is null or secret.pin_hash is null or secret.locked_until>now_at or p_pin is null or length(p_pin)>12 or secret.pin_hash is distinct from extensions.crypt(p_pin,secret.pin_hash) then
  update private.kiosk_devices set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now_at+interval '5 minutes' end where id=d.id;
  if w.id is not null then update private.worker_pin_secrets set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now_at+interval '5 minutes' end where worker_id=w.id;end if;
  insert into private.kiosk_security_audit(company_id,device_id,worker_id,action) values(d.company_id,d.id,w.id,'identity_failed');
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;
 update private.kiosk_devices set failed_attempts=0,locked_until=null where id=d.id;
 update private.worker_pin_secrets set failed_attempts=0,locked_until=null where worker_id=w.id;
 -- Mobile APIs lock by Auth ID. Use that SAME key when linked; otherwise stable worker ID.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(d.company_id::text||coalesce(w.auth_user_id,w.id)::text,0));
 select * into s from public.punch_sessions where company_id=d.company_id and worker_id=w.id and ended_at is null for update;
 paused:=exists(select 1 from public.punch_breaks where session_id=s.id and ended_at is null);
 if p_action='identify' then return jsonb_build_object('ok',true,'name',w.first_name,'active',s.id is not null,'paused',paused,'started_at',s.started_at,'server_time',now_at);end if;
 if p_action='enroll' or p_event is null then return jsonb_build_object('ok',false,'error','EVENT_REQUIRED');end if;
 select * into prior from private.kiosk_events where event_id=p_event;
 if found then
  if prior.device_id=d.id and prior.worker_id=w.id and prior.action=p_action then return prior.result;end if;
  return jsonb_build_object('ok',false,'error','EVENT_CONFLICT');
 end if;
 if p_action='in' then
  if s.id is not null then return jsonb_build_object('ok',false,'error','ALREADY_ACTIVE');end if;
  perform private.assert_open_period(d.company_id,now_at,now_at+interval '1 microsecond');
  insert into public.punch_sessions(company_id,user_id,worker_id,started_at) values(d.company_id,w.auth_user_id,w.id,now_at) returning id into session_id;
  insert into public.punch_segments(company_id,session_id,job_id,started_at) values(d.company_id,session_id,d.site_id,now_at);
 elsif s.id is null then return jsonb_build_object('ok',false,'error','NO_ACTIVE_SESSION');
 else
  session_id:=s.id;perform private.assert_open_period(d.company_id,s.started_at,now_at);
  if p_action='out' then
   update public.punch_segments set ended_at=now_at where punch_segments.session_id=s.id and ended_at is null;
   update public.punch_sessions set ended_at=now_at where id=s.id;
  elsif p_action='break_start' then
   if paused then return jsonb_build_object('ok',false,'error','ALREADY_PAUSED');end if;
   insert into public.punch_breaks(company_id,session_id,user_id,started_at) values(d.company_id,s.id,w.auth_user_id,now_at);
  elsif p_action='break_end' then
   if not paused then return jsonb_build_object('ok',false,'error','NOT_PAUSED');end if;
   update public.punch_breaks set ended_at=now_at where punch_breaks.session_id=s.id and ended_at is null;
  end if;
 end if;
 result:=jsonb_build_object('ok',true,'session_id',session_id,'action',p_action,'server_time',now_at);
 insert into private.kiosk_events(event_id,company_id,device_id,worker_id,action,result) values(p_event,d.company_id,d.id,w.id,p_action,result);
 return result;
end $$;
revoke all on function public.create_kiosk_pairing(uuid,text),public.list_kiosk_devices(uuid),public.revoke_kiosk(uuid,text),public.create_pin_enrollment(uuid) from public,anon;
grant execute on function public.create_kiosk_pairing(uuid,text),public.list_kiosk_devices(uuid),public.revoke_kiosk(uuid,text),public.create_pin_enrollment(uuid) to authenticated;
revoke all on function public.kiosk_pair_device(text),public.kiosk_execute(uuid,text,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kiosk_pair_device(text),public.kiosk_execute(uuid,text,text,text,text,uuid,text) to service_role;
