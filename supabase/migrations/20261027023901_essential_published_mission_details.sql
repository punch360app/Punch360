-- MISSION-004 partial: instructions of a *published* mission shown only on explicit worker request.
-- The privileged read never grants table access and does not return site codes, private client notes,
-- employee identifiers, location secrets, other workers' missions or other companies' data.
create function public.get_essential_published_mission_details(
 p_company uuid,p_id uuid,p_version integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_worker uuid;v private.essential_missions;
begin
 if auth.uid() is null or not private.is_member(p_company) or not exists(
  select 1 from public.companies c where c.id=p_company and c.product_edition='essential'
 ) or not exists(
  select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled
 ) then
  raise exception using errcode='42501',message='Détails de mission non autorisés dans cette compagnie';end if;
 if p_id is null or p_version is null or p_version<1 then
  raise exception using errcode='22023',message='Identifiant ou version de mission invalide';end if;
 select w.id into v_worker from public.company_workers w
 where w.company_id=p_company and w.auth_user_id=auth.uid()
  and w.status='active' and w.personal_access;
 if v_worker is null then
  raise exception using errcode='42501',message='Compte salarié personnel requis';end if;
 select * into v from private.essential_missions m
 where m.company_id=p_company and m.id=p_id and m.worker_id=v_worker
  and m.status='published' and m.version=p_version;
 if not found then
  raise exception using errcode='42501',message='Mission introuvable, modifiée ou non publiée pour ce salarié';end if;
 return jsonb_build_object('id',v.id,'version',v.version,
  'title',v.title,'instructions',v.instructions);
end $$;
revoke all on function public.get_essential_published_mission_details(uuid,uuid,integer) from public,anon;
grant execute on function public.get_essential_published_mission_details(uuid,uuid,integer) to authenticated;
