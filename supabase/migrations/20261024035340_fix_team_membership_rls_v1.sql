-- Remove cyclical RLS policy subqueries between teams and team_members.
create function private.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.team_members tm join public.company_members m
 on m.company_id=tm.company_id and m.user_id=tm.user_id
 where tm.team_id=p_team and tm.user_id=(select auth.uid()) and m.status='active') $$;
create function private.is_team_lead(p_team uuid) returns boolean
language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and exists(
 select 1 from public.teams t join public.company_members m
 on m.company_id=t.company_id and m.user_id=t.lead_user_id
 where t.id=p_team and t.lead_user_id=(select auth.uid()) and m.status='active' and m.role='lead') $$;
revoke all on function private.is_team_member(uuid),private.is_team_lead(uuid) from public,anon;
grant execute on function private.is_team_member(uuid),private.is_team_lead(uuid) to authenticated;
drop policy team_read on public.teams;
create policy team_read on public.teams for select to authenticated using(
 private.is_manager(company_id) or private.is_team_lead(id) or private.is_team_member(id));
drop policy team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated using(
 user_id=(select auth.uid()) or private.is_manager(company_id) or private.is_team_lead(team_id));
