-- Lock administrative mutations after unpaid grace, never lock employee time logging or history.
create function private.can_administer(p_company uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select private.is_manager(p_company) and exists (
 select 1 from public.companies c
 where c.id=p_company and c.billing_status in ('setup','active','grace')
) $$;
revoke all on function private.can_administer(uuid) from public,anon;
grant execute on function private.can_administer(uuid) to authenticated;

drop policy jobs_create on public.jobs;
create policy jobs_create on public.jobs for insert to authenticated with check(private.can_administer(company_id));
drop policy jobs_update on public.jobs;
create policy jobs_update on public.jobs for update to authenticated using(private.can_administer(company_id)) with check(private.can_administer(company_id));
drop policy assignment_create on public.job_assignments;
create policy assignment_create on public.job_assignments for insert to authenticated with check(private.can_administer(company_id));
drop policy assignment_update on public.job_assignments;
create policy assignment_update on public.job_assignments for update to authenticated using(private.can_administer(company_id)) with check(private.can_administer(company_id));
drop policy docs_add on public.job_documents;
create policy docs_add on public.job_documents for insert to authenticated with check(private.can_administer(company_id) and created_by=(select auth.uid()));

-- A company boss may update its display name but NEVER its price, seats or billing state.
drop policy companies_edit on public.companies;
create policy companies_edit on public.companies for update to authenticated
 using(private.can_administer(id)) with check(private.can_administer(id));
grant update(name) on public.companies to authenticated;

-- The only affected RPCs are the management RPCs. This preserves the original
-- transactional server-clock punch functions and their regardless-of-payment access.
do $$
declare r record;
begin
 for r in select pg_get_functiondef(p.oid) as definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
  ('create_team','add_team_employee','create_company_group','add_group_member')
 loop
  execute replace(r.definition,'private.is_manager(', 'private.can_administer(');
 end loop;
end $$;
