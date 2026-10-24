-- Scope a lead's hours to jobs that their team actually supervises.
create table public.team_jobs (
 company_id uuid not null,
 team_id uuid not null,
 job_id uuid not null,
 assigned_at timestamptz not null default now(),
 primary key(company_id,team_id,job_id),
 foreign key(company_id,team_id) references public.teams(company_id,id) on delete cascade,
 foreign key(company_id,job_id) references public.jobs(company_id,id) on delete cascade
);
alter table public.team_jobs enable row level security;

create function private.lead_sees_job_for_worker(p_company uuid,p_worker uuid,p_job uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.teams t
 join public.team_members tm on tm.company_id=t.company_id and tm.team_id=t.id
 join public.team_jobs tj on tj.company_id=t.company_id and tj.team_id=t.id
 join public.company_members manager on manager.company_id=t.company_id and manager.user_id=t.lead_user_id
 where t.company_id=p_company and t.lead_user_id=(select auth.uid())
 and tm.user_id=p_worker and tj.job_id=p_job
 and manager.status='active' and manager.role='lead'
) $$;
create function private.lead_sees_session(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.punch_sessions s
 join public.punch_segments ps on ps.session_id=s.id and ps.company_id=s.company_id
 where s.id=p_session and private.lead_sees_job_for_worker(s.company_id,s.user_id,ps.job_id)
) $$;
revoke all on function private.lead_sees_job_for_worker(uuid,uuid,uuid),private.lead_sees_session(uuid) from public,anon;
grant execute on function private.lead_sees_job_for_worker(uuid,uuid,uuid),private.lead_sees_session(uuid) to authenticated;

create policy team_jobs_read on public.team_jobs for select to authenticated
using(private.is_manager(company_id) or private.is_team_lead(team_id));
create policy team_jobs_add on public.team_jobs for insert to authenticated
with check(private.can_administer(company_id));
create policy team_jobs_delete on public.team_jobs for delete to authenticated using(private.can_administer(company_id));
grant select on public.team_jobs to authenticated;
grant insert(company_id,team_id,job_id),delete on public.team_jobs to authenticated;

drop policy sessions_read on public.punch_sessions;
create policy sessions_read on public.punch_sessions for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id) or private.lead_sees_session(id));
drop policy segments_read on public.punch_segments;
create policy segments_read on public.punch_segments for select to authenticated
 using(exists(
  select 1 from public.punch_sessions s
  where s.id=session_id and s.company_id=company_id and
   (s.user_id=(select auth.uid()) or private.is_manager(company_id)
    or private.lead_sees_job_for_worker(company_id,s.user_id,job_id))
 ));
