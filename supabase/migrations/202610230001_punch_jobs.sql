-- PUNCH 360° — NE PAS exécuter sur une base autre que PUNCH.
-- Schéma préparé dans GitHub seulement, non déployé.
create extension if not exists pgcrypto;
create schema if not exists private;
create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.company_members (
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('employee','lead','admin','boss')),
 status text not null default 'active' check(status in ('active','invited','disabled')),
 created_at timestamptz not null default now(),
 primary key(company_id,user_id)
);
create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 number text not null,
 name text not null,
 address text not null default '',
 latitude double precision check (latitude between -90 and 90),
 longitude double precision check (longitude between -180 and 180),
 photo_url text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(company_id,number),unique(company_id,id)
);
create table if not exists public.job_assignments (
 company_id uuid not null,
 job_id uuid not null,
 user_id uuid not null,
 active boolean not null default true,
 primary key(company_id,job_id,user_id),
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id) on delete cascade
);
create table if not exists public.punch_sessions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 user_id uuid not null,
 started_at timestamptz not null,
 ended_at timestamptz,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id),
 check(ended_at is null or ended_at>=started_at)
);
create unique index if not exists one_active_session_per_employee on public.punch_sessions(company_id,user_id) where ended_at is null;
create table if not exists public.punch_segments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 session_id uuid not null references public.punch_sessions(id) on delete cascade,
 job_id uuid not null,
 started_at timestamptz not null,
 ended_at timestamptz,
 foreign key(company_id,job_id) references public.jobs(company_id,id),
 check(ended_at is null or ended_at>=started_at)
);
create table if not exists public.punch_archive_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 segment_id uuid not null references public.punch_segments(id) on delete cascade,
 archived_at timestamptz not null default now(),
 primary key(user_id,segment_id)
);
create or replace function private.is_company_member(c uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.company_members m where m.company_id=c and m.user_id=(select auth.uid()) and m.status='active') $$;
create or replace function private.is_company_manager(c uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.company_members m where m.company_id=c and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('boss','admin')) $$;
revoke all on function private.is_company_member(uuid),private.is_company_manager(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_company_member(uuid),private.is_company_manager(uuid) to authenticated;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.punch_sessions enable row level security;
alter table public.punch_segments enable row level security;
alter table public.punch_archive_preferences enable row level security;
create policy company_view on public.companies for select to authenticated using(created_by=(select auth.uid()) or private.is_company_member(id));
create policy company_create on public.companies for insert to authenticated with check(created_by=(select auth.uid()));
create policy company_manage on public.companies for update to authenticated using(private.is_company_manager(id)) with check(private.is_company_manager(id));
create policy members_view on public.company_members for select to authenticated using(user_id=(select auth.uid()) or private.is_company_manager(company_id));
create policy founder_join_as_boss on public.company_members for insert to authenticated
with check(user_id=(select auth.uid()) and role='boss' and status='active' and exists(select 1 from public.companies c where c.id=company_id and c.created_by=(select auth.uid())));
create policy jobs_view on public.jobs for select to authenticated using(private.is_company_member(company_id));
create policy jobs_add on public.jobs for insert to authenticated with check(private.is_company_manager(company_id));
create policy jobs_edit on public.jobs for update to authenticated using(private.is_company_manager(company_id)) with check(private.is_company_manager(company_id));
create policy assignments_view on public.job_assignments for select to authenticated using(user_id=(select auth.uid()) or private.is_company_manager(company_id));
create policy assignments_add on public.job_assignments for insert to authenticated with check(private.is_company_manager(company_id));
create policy assignments_edit on public.job_assignments for update to authenticated using(private.is_company_manager(company_id)) with check(private.is_company_manager(company_id));
create policy sessions_view on public.punch_sessions for select to authenticated using(user_id=(select auth.uid()) or private.is_company_manager(company_id));
create policy segments_view on public.punch_segments for select to authenticated using(exists(select 1 from public.punch_sessions s where s.id=session_id and s.company_id=company_id and (s.user_id=(select auth.uid()) or private.is_company_manager(company_id))));
create policy archives_view on public.punch_archive_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy archives_add on public.punch_archive_preferences for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.punch_segments ps join public.punch_sessions s on s.id=ps.session_id where ps.id=segment_id and s.user_id=(select auth.uid())));
create policy archives_remove on public.punch_archive_preferences for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,update on public.companies to authenticated;
grant select,insert on public.company_members to authenticated;
grant select,insert,update on public.jobs,public.job_assignments to authenticated;
grant select on public.punch_sessions,public.punch_segments to authenticated;
grant select,insert,delete on public.punch_archive_preferences to authenticated;
-- Moteur serveur IN/OUT/TRANSFERT + corrections : RPC transactionnelles séparées (pas d'INSERT/UPDATE direct).
