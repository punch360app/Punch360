
-- PUNCH 360: noyau multi-entreprise. Horodatages officiels par le serveur.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 140),
  created_by uuid not null references auth.users(id),
  billing_status text not null default 'setup' check (billing_status in ('setup','active','grace','restricted','cancelled')),
  seat_limit integer not null default 1 check (seat_limit >= 1),
  created_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('employee','lead','admin','boss')),
  status text not null default 'active' check(status in ('active','disabled')),
  joined_at timestamptz not null default now(),
  primary key (company_id,user_id)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number text not null check (length(trim(number)) between 1 and 40),
  name text not null check (length(trim(name)) between 1 and 160),
  address text not null default '',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,number),
  unique(company_id,id)
);
create table public.job_assignments (
  company_id uuid not null,
  job_id uuid not null,
  user_id uuid not null,
  active boolean not null default true,
  planned_start date,
  created_at timestamptz not null default now(),
  primary key(company_id,job_id,user_id),
  foreign key (company_id,job_id) references public.jobs(company_id,id) on delete cascade,
  foreign key (company_id,user_id) references public.company_members(company_id,user_id) on delete cascade
);
create table public.punch_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,user_id) references public.company_members(company_id,user_id),
  check(ended_at is null or ended_at>=started_at)
);
create unique index one_open_punch_per_worker_per_company on public.punch_sessions(company_id,user_id) where ended_at is null;
create index punch_sessions_user_started on public.punch_sessions(company_id,user_id,started_at desc);
create table public.punch_segments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  session_id uuid not null,
  job_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(company_id,session_id) references public.punch_sessions(company_id,id) on delete cascade,
  foreign key(company_id,job_id) references public.jobs(company_id,id),
  check(ended_at is null or ended_at>=started_at)
);
create unique index one_open_segment_per_session on public.punch_segments(session_id) where ended_at is null;
create index punch_segments_session_order on public.punch_segments(session_id,started_at);
create table public.punch_archive_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_id uuid not null references public.punch_segments(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key(user_id,segment_id)
);
create table public.punch_correction_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  session_id uuid not null,
  requested_by uuid not null,
  requested_start timestamptz,
  requested_end timestamptz,
  reason text not null check(length(trim(reason)) between 3 and 1500),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  foreign key(company_id,session_id) references public.punch_sessions(company_id,id) on delete cascade,
  foreign key(company_id,requested_by) references public.company_members(company_id,user_id)
);
create table public.job_documents (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 job_id uuid not null,
 name text not null,
 kind text not null default 'plan',
 storage_path text not null,
 version integer not null default 1 check(version>=1),
 requires_ack boolean not null default false,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade
);
create table public.material_orders (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 job_id uuid not null,
 created_by uuid not null,
 status text not null default 'requested' check(status in ('requested','approved','ordered','delivered','rejected')),
 note text,
 created_at timestamptz not null default now(),
 foreign key(company_id,job_id) references public.jobs(company_id,id),
 foreign key(company_id,created_by) references public.company_members(company_id,user_id)
);
create table public.leave_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 user_id uuid not null,
 leave_type text not null check(leave_type in ('vacation','sick','personal','other')),
 begins_on date not null, ends_on date not null,
 reason text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),
 check(ends_on>=begins_on),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create table public.employee_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 phone text,
 photo_path text,
 updated_at timestamptz not null default now()
);
create table public.emergency_contacts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 relationship text,
 phone text not null,
 priority integer not null default 1 check(priority between 1 and 2),
 unique(user_id,priority)
);
create table public.employee_credentials (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 credential_type text not null,
 trade text,
 expires_on date,
 storage_path text,
 created_at timestamptz not null default now()
);

-- Helpers in a non-exposed schema. Each checks auth.uid() rather than trusting metadata.
create function private.is_member(c uuid)
returns boolean language sql stable security definer set search_path=''
as $$select (select auth.uid()) is not null and exists(
 select 1 from public.company_members m
 where m.company_id=c and m.user_id=(select auth.uid()) and m.status='active'
)$$;
create function private.is_manager(c uuid)
returns boolean language sql stable security definer set search_path=''
as $$select (select auth.uid()) is not null and exists(
 select 1 from public.company_members m
 where m.company_id=c and m.user_id=(select auth.uid()) and m.status='active'
 and m.role in ('boss','admin')
)$$;
revoke all on function private.is_member(uuid),private.is_manager(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid),private.is_manager(uuid) to authenticated;

-- RLS on EVERY exposed business table.
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.punch_sessions enable row level security;
alter table public.punch_segments enable row level security;
alter table public.punch_archive_preferences enable row level security;
alter table public.punch_correction_requests enable row level security;
alter table public.job_documents enable row level security;
alter table public.material_orders enable row level security;
alter table public.leave_requests enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.employee_credentials enable row level security;

create policy companies_read on public.companies for select to authenticated using(private.is_member(id));
create policy companies_edit on public.companies for update to authenticated
 using(private.is_manager(id)) with check(private.is_manager(id));
create policy members_read on public.company_members for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id));
create policy jobs_read on public.jobs for select to authenticated using(private.is_member(company_id));
create policy jobs_create on public.jobs for insert to authenticated with check(private.is_manager(company_id));
create policy jobs_update on public.jobs for update to authenticated
 using(private.is_manager(company_id)) with check(private.is_manager(company_id));
create policy assignment_read on public.job_assignments for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id));
create policy assignment_create on public.job_assignments for insert to authenticated
 with check(private.is_manager(company_id));
create policy assignment_update on public.job_assignments for update to authenticated
 using(private.is_manager(company_id)) with check(private.is_manager(company_id));
create policy sessions_read on public.punch_sessions for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id));
create policy segments_read on public.punch_segments for select to authenticated
 using(exists(select 1 from public.punch_sessions s where s.id=session_id
 and s.company_id=company_id and (s.user_id=(select auth.uid()) or private.is_manager(company_id))));
create policy archives_read on public.punch_archive_preferences for select to authenticated
 using(user_id=(select auth.uid()));
create policy archives_insert on public.punch_archive_preferences for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(
 select 1 from public.punch_segments ps join public.punch_sessions s on s.id=ps.session_id and s.company_id=ps.company_id
 where ps.id=segment_id and s.user_id=(select auth.uid())));
create policy archives_delete on public.punch_archive_preferences for delete to authenticated
 using(user_id=(select auth.uid()));
create policy corrections_read on public.punch_correction_requests for select to authenticated
 using(requested_by=(select auth.uid()) or private.is_manager(company_id));
create policy corrections_add on public.punch_correction_requests for insert to authenticated
 with check(requested_by=(select auth.uid()) and status='pending' and reviewed_by is null and exists(
 select 1 from public.punch_sessions s where s.id=session_id and s.company_id=company_id and s.user_id=(select auth.uid())));
create policy docs_read on public.job_documents for select to authenticated using(private.is_member(company_id));
create policy docs_add on public.job_documents for insert to authenticated
 with check(private.is_manager(company_id) and created_by=(select auth.uid()));
create policy orders_read on public.material_orders for select to authenticated
 using(created_by=(select auth.uid()) or private.is_manager(company_id));
create policy orders_add on public.material_orders for insert to authenticated
 with check(created_by=(select auth.uid()) and status='requested' and private.is_member(company_id));
create policy leave_read on public.leave_requests for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id));
create policy leave_create on public.leave_requests for insert to authenticated
 with check(user_id=(select auth.uid()) and status='pending' and private.is_member(company_id));
create policy profile_read on public.employee_profiles for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.company_members m
 where m.user_id=public.employee_profiles.user_id and private.is_manager(m.company_id)));
create policy profile_insert on public.employee_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy profile_update on public.employee_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy contact_read on public.emergency_contacts for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.company_members m
 where m.user_id=public.emergency_contacts.user_id and private.is_manager(m.company_id)));
create policy contact_add on public.emergency_contacts for insert to authenticated with check(user_id=(select auth.uid()));
create policy contact_edit on public.emergency_contacts for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy contact_remove on public.emergency_contacts for delete to authenticated using(user_id=(select auth.uid()));
create policy cred_read on public.employee_credentials for select to authenticated
 using(user_id=(select auth.uid()) or exists(select 1 from public.company_members m
 where m.user_id=public.employee_credentials.user_id and private.is_manager(m.company_id)));
create policy cred_add on public.employee_credentials for insert to authenticated with check(user_id=(select auth.uid()));
create policy cred_edit on public.employee_credentials for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy cred_remove on public.employee_credentials for delete to authenticated using(user_id=(select auth.uid()));

-- Restrict table mutation where the only legitimate path is a verified transactional RPC.
revoke all on public.companies,public.company_members,public.jobs,public.job_assignments,public.punch_sessions,public.punch_segments,public.punch_archive_preferences,public.punch_correction_requests,public.job_documents,public.material_orders,public.leave_requests,public.employee_profiles,public.emergency_contacts,public.employee_credentials from anon;
grant select on public.companies,public.company_members,public.jobs,public.job_assignments,public.punch_sessions,public.punch_segments,public.punch_correction_requests,public.job_documents,public.material_orders,public.leave_requests,public.employee_profiles,public.emergency_contacts,public.employee_credentials to authenticated;
grant update(name,address,latitude,longitude,photo_url,active) on public.jobs to authenticated;
grant insert(company_id,number,name,address,latitude,longitude,photo_url,active) on public.jobs to authenticated;
grant insert(company_id,job_id,user_id,active,planned_start),update(active,planned_start) on public.job_assignments to authenticated;
grant select,insert,delete on public.punch_archive_preferences to authenticated;
grant insert(company_id,session_id,requested_by,requested_start,requested_end,reason) on public.punch_correction_requests to authenticated;
grant insert(company_id,job_id,name,kind,storage_path,version,requires_ack,created_by) on public.job_documents to authenticated;
grant insert(company_id,job_id,created_by,note) on public.material_orders to authenticated;
grant insert(company_id,user_id,leave_type,begins_on,ends_on,reason) on public.leave_requests to authenticated;
grant insert(user_id,full_name,phone,photo_path),update(full_name,phone,photo_path) on public.employee_profiles to authenticated;
grant insert(user_id,name,relationship,phone,priority),update(name,relationship,phone,priority),delete on public.emergency_contacts to authenticated;
grant insert(user_id,credential_type,trade,expires_on,storage_path),update(credential_type,trade,expires_on,storage_path),delete on public.employee_credentials to authenticated;

-- Authenticated self-service creating a company; payment is still REQUIRED before invitations can be issued.
create function public.create_my_company(p_name text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 140 then raise exception 'Invalid company name'; end if;
 insert into public.companies(name,created_by) values(trim(p_name),v_uid) returning id into v_id;
 insert into public.company_members(company_id,user_id,role,status) values(v_id,v_uid,'boss','active');
 return v_id;
end $$;

-- A single transaction per operation. No client supplied timestamps. Caller always operates on own session.
create function public.punch_in(p_company uuid,p_job uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_now timestamptz;
begin
 if v_uid is null or not private.is_member(p_company) then raise exception 'Not a member'; end if;
 if not exists(select 1 from public.jobs where id=p_job and company_id=p_company and active) then raise exception 'Invalid job'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||v_uid::text,0));
 if exists(select 1 from public.punch_sessions where company_id=p_company and user_id=v_uid and ended_at is null)
 then raise exception 'Punch already active'; end if;
 v_now:=clock_timestamp();
 insert into public.punch_sessions(company_id,user_id,started_at) values(p_company,v_uid,v_now) returning id into v_id;
 insert into public.punch_segments(company_id,session_id,job_id,started_at) values(p_company,v_id,p_job,v_now);
 return v_id;
end $$;

create function public.punch_transfer(p_company uuid,p_job uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := auth.uid(); v_session uuid; v_current uuid; v_now timestamptz;
begin
 if v_uid is null or not private.is_member(p_company) then raise exception 'Not a member'; end if;
 if not exists(select 1 from public.jobs where id=p_job and company_id=p_company and active) then raise exception 'Invalid job'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||v_uid::text,0));
 select id into v_session from public.punch_sessions
 where company_id=p_company and user_id=v_uid and ended_at is null for update;
 if v_session is null then raise exception 'No active punch'; end if;
 select job_id into v_current from public.punch_segments where session_id=v_session and ended_at is null for update;
 if v_current is null then raise exception 'Active segment missing'; end if;
 if v_current=p_job then return v_session; end if;
 v_now:=clock_timestamp();
 update public.punch_segments set ended_at=v_now where session_id=v_session and ended_at is null;
 insert into public.punch_segments(company_id,session_id,job_id,started_at) values(p_company,v_session,p_job,v_now);
 return v_session;
end $$;

create function public.punch_out(p_company uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := auth.uid(); v_session uuid; v_now timestamptz;
begin
 if v_uid is null or not private.is_member(p_company) then raise exception 'Not a member'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||v_uid::text,0));
 select id into v_session from public.punch_sessions
 where company_id=p_company and user_id=v_uid and ended_at is null for update;
 if v_session is null then raise exception 'No active punch'; end if;
 v_now:=clock_timestamp();
 update public.punch_segments set ended_at=v_now where session_id=v_session and ended_at is null;
 if not found then raise exception 'Active segment missing'; end if;
 update public.punch_sessions set ended_at=v_now where id=v_session;
 return v_session;
end $$;

revoke all on function public.create_my_company(text),public.punch_in(uuid,uuid),public.punch_transfer(uuid,uuid),public.punch_out(uuid) from public,anon;
grant execute on function public.create_my_company(text),public.punch_in(uuid,uuid),public.punch_transfer(uuid,uuid),public.punch_out(uuid) to authenticated;
