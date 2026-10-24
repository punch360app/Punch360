create function public.essential_company_dashboard(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_manager(p_company) or not exists(select 1 from public.companies where id=p_company and product_edition='essential') then raise exception using errcode='42501',message='Gestionnaire Essentiel requis';end if;
 return public.company_dashboard(p_company)||jsonb_build_object(
 'present',(select count(*) from public.punch_sessions where company_id=p_company and ended_at is null),
 'paused',(select count(*) from public.punch_breaks where company_id=p_company and ended_at is null),
 'departments',(select count(*) from public.essential_departments where company_id=p_company and active),
 'locations',(select count(*) from public.essential_locations where company_id=p_company and active),
 'vacant_shifts',(select count(*) from public.scheduled_shifts where company_id=p_company and worker_id is null and cancelled_at is null and ends_at>clock_timestamp()));
end $$;
revoke all on function public.essential_company_dashboard(uuid) from public,anon;
grant execute on function public.essential_company_dashboard(uuid) to authenticated;
create or replace function public.essential_team_roster(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.first_name||' '||w.last_name,'employee_number',w.employee_number,'location_id',w.location_id,'department_id',w.department_id,'status',w.status,
 'working',exists(select 1 from public.punch_sessions p where p.company_id=w.company_id and p.worker_id=w.id and p.ended_at is null),
 'paused',exists(select 1 from public.punch_breaks b join public.punch_sessions p on p.id=b.session_id where p.company_id=w.company_id and p.worker_id=w.id and p.ended_at is null and b.ended_at is null))) from public.company_workers w where company_id=p_company and private.essential_sees_worker(p_company,w.id)),'[]'::jsonb);
end $$;
