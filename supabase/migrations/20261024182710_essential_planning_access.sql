create function public.save_essential_local_shift(p_company uuid,p_worker uuid,p_location uuid,p_department uuid,p_start_local timestamp,p_end_local timestamp,p_note text default '',p_shift uuid default null,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_zone text;
begin
 if not private.essential_can_plan(p_company,p_department) then raise exception using errcode='42501',message='Planification non autorisée';end if;
 select timezone into v_zone from public.essential_locations where company_id=p_company and id=p_location and active;
 if v_zone is null then raise exception 'Établissement invalide';end if;
 return public.save_essential_shift(p_company,p_worker,p_location,p_department,private.essential_local_instant(p_start_local,v_zone),private.essential_local_instant(p_end_local,v_zone),p_note,p_shift,p_expected_version);
end $$;
create function public.set_essential_local_availability(p_company uuid,p_location uuid,p_start_local timestamp,p_end_local timestamp,p_available boolean,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare v_zone text;
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 select timezone into v_zone from public.essential_locations where company_id=p_company and id=p_location and active;
 if v_zone is null then raise exception 'Établissement invalide';end if;
 return public.set_essential_availability(p_company,private.essential_local_instant(p_start_local,v_zone),private.essential_local_instant(p_end_local,v_zone),p_available,p_note);
end $$;
revoke all on function public.save_essential_local_shift(uuid,uuid,uuid,uuid,timestamp,timestamp,text,uuid,integer),public.set_essential_local_availability(uuid,uuid,timestamp,timestamp,boolean,text) from public,anon;
grant execute on function public.save_essential_local_shift(uuid,uuid,uuid,uuid,timestamp,timestamp,text,uuid,integer),public.set_essential_local_availability(uuid,uuid,timestamp,timestamp,boolean,text) to authenticated;
-- Keep historical extra sites readable after a downgrade, but prevent new use beyond the entitlement.
do $$
declare v_def text;v_guard text;
begin
 v_guard:='if not private.essential_feature(p_company,''multiple_establishments'') and exists(select 1 from public.essential_locations l join public.companies c on c.id=l.company_id where l.company_id=p_company and l.id=p_location and l.punch_job_id<>c.default_punch_job_id) then raise exception ''Planification interétablissements : forfait Pro requis'';end if;';
 select pg_get_functiondef('public.save_essential_shift(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer)'::regprocedure) into v_def;
 execute replace(v_def,'select punch_job_id into v_job',v_guard||E'\n select punch_job_id into v_job');
end $$;
