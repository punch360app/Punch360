-- Isolated PostgreSQL 17 compatibility harness for the QR DRAFTS.
-- Synthetic structures ONLY, never Supabase production or a real Auth project.
-- The existing PIN engine below is a deliberately limited MOCK. Passing this
-- file proves SQL syntax/QR registry/adapter boundaries, NOT production RLS,
-- PIN throttling, offline ledger, migrations, or end-to-end Supabase behavior.
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema private;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public to anon,authenticated,service_role;
grant usage on schema auth to authenticated,service_role;

create function auth.uid() returns uuid language sql stable set search_path='' as $$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to authenticated,service_role;

create table auth.users (id uuid primary key);
create table public.companies (
 id uuid primary key, product_edition text not null
);
create table public.company_members (
 company_id uuid not null references public.companies(id),
 user_id uuid not null references auth.users(id),
 status text not null,role text not null,
 primary key(company_id,user_id)
);
create table public.company_workers (
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 auth_user_id uuid references auth.users(id),
 employee_number text not null,
 status text not null,role text not null,
 can_kiosk_punch boolean not null,personal_access boolean not null,
 unique(company_id,id),unique(company_id,employee_number)
);
create table public.jobs (
 id uuid primary key, company_id uuid not null references public.companies(id),
 active boolean not null,unique(company_id,id)
);
create table public.essential_locations (
 company_id uuid not null,punch_job_id uuid not null,active boolean not null,
 unique(company_id,punch_job_id),
 foreign key(company_id,punch_job_id) references public.jobs(company_id,id)
);
create table public.workforce_audit (
 company_id uuid not null references public.companies(id),
 actor_id uuid references auth.users(id),
 action text not null,entity_id uuid not null,reason text not null
);
create table private.kiosk_devices (
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 site_id uuid not null,
 token_hash bytea,paired_at timestamptz,
 revoked_at timestamptz,locked_until timestamptz,
 foreign key(company_id,site_id) references public.jobs(company_id,id)
);
create table private.isolated_kiosk_receipts (
 event_id uuid primary key,worker_id uuid not null,
 action text not null,result jsonb not null
);

-- In actual Supabase these functions and tables are supplied by migrations.
create function private.can_administer(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_members m
  where m.company_id=p_company and m.user_id=auth.uid()
    and m.status='active' and m.role in ('boss','admin'))
$$;
create function private.is_manager(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.can_administer(p_company)
$$;

-- Only a synthetic stand-in to verify the QR adapter delegates to an
-- independent PIN check and retains eventId in a separate receipt ledger.
-- It is NOT the real rate-limited public.kiosk_execute implementation.
create function public.kiosk_execute(
 p_device uuid,p_token text,p_number text,p_pin text,
 p_action text,p_event uuid,p_enrollment text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;w public.company_workers;old_result jsonb;out_result jsonb;
begin
 select * into d from private.kiosk_devices where id=p_device;
 if not found or d.paired_at is null or d.revoked_at is not null
   or d.token_hash is distinct from sha256(convert_to(p_token,'UTF8')) then
  return jsonb_build_object('ok',false,'error','DEVICE_DENIED');
 end if;
 select * into w from public.company_workers
  where company_id=d.company_id and employee_number=p_number;
 if not found or w.status<>'active' or not w.can_kiosk_punch
    or p_pin<>'829471' then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;
 if p_action='identify' then
  return jsonb_build_object('ok',true,'worker_id',w.id);
 end if;
 if p_event is null then
  return jsonb_build_object('ok',false,'error','EVENT_REQUIRED');
 end if;
 select result into old_result from private.isolated_kiosk_receipts
  where event_id=p_event;
 if found then return old_result;end if;
 out_result:=jsonb_build_object('ok',true,'worker_id',w.id,
  'event_id',p_event,'action',p_action);
 insert into private.isolated_kiosk_receipts(event_id,worker_id,action,result)
  values(p_event,w.id,p_action,out_result);
 return out_result;
end $$;
revoke all on function public.kiosk_execute(uuid,text,text,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.kiosk_execute(uuid,text,text,text,text,uuid,text)
 to service_role;
