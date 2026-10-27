-- MISSION-008/009: explicit manager-only correction of one published mission rank.
-- Never change the employee, customer, time, status or existing punch/shift.
-- Only the assigned employee receives a neutral internal notification.
create function public.set_essential_published_mission_order(
 p_company uuid,p_mission uuid,p_expected_version integer,p_order integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_new_version integer;v_recipient uuid;v_notified boolean:=false;
begin
 if not private.essential_mission_manager(p_company) or not exists(
  select 1 from private.essential_mission_settings
  where company_id=p_company and enabled
 ) then
  raise exception using errcode='42501',message='Ordre des missions réservé au responsable';
 end if;
 if p_mission is null or p_expected_version is null or p_expected_version<=0 or
  p_order is null or p_order<1 or p_order>999 then
  raise exception using errcode='22023',message='Mission, version et rang (1 à 999) requis';
 end if;
 select * into v from private.essential_missions
 where id=p_mission and company_id=p_company for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 if v.status<>'published' then
  raise exception using errcode='22023',message='Seule une mission publiée et non terminée peut changer de rang';
 end if;
 if v.version<>p_expected_version then
  raise exception using errcode='22023',message='Mission modifiée. Actualisez avant de confirmer son nouveau rang';
 end if;
 if v.sort_order=p_order then
  return jsonb_build_object('id',v.id,'version',v.version,'sort_order',v.sort_order,
   'changed',false,'notified',false);
 end if;
 -- Competing reorder requests for the same worker/day cannot both claim the
 -- same free rank. Publication itself may still add new tasks; this endpoint
 -- never hides any pre-existing conflicts or silently edits other missions.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'mission-reorder:'||p_company::text||':'||v.worker_id::text||':'||v.mission_day::text,0));
 if exists(select 1 from private.essential_missions other
  where other.company_id=p_company and other.worker_id=v.worker_id
   and other.mission_day=v.mission_day and other.id<>v.id
   and other.status='published' and other.sort_order=p_order) then
  raise exception using errcode='22023',
   message='Rang déjà occupé par une mission publiée de cet employé pour cette journée';
 end if;
 update private.essential_missions set
  sort_order=p_order,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_mission returning version into v_new_version;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_published_order_changed',p_mission,
  jsonb_build_object('sort_order',v.sort_order,'version',v.version),
  jsonb_build_object('sort_order',p_order,'version',v_new_version),
  'Correction explicite d’une mission publiée; aucune heure ni adresse modifiée');
 select w.auth_user_id into v_recipient
 from public.company_workers w join public.company_members m
  on m.company_id=w.company_id and m.user_id=w.auth_user_id and m.status='active'
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access;
 if v_recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_recipient,'mission_published','Ordre de tournée actualisé',
  'Votre responsable a modifié l’ordre des missions du '||
    pg_catalog.to_char(v.mission_day,'YYYY-MM-DD')||'. Consultez votre tournée.');
  v_notified:=true;
 end if;
 return jsonb_build_object('id',v.id,'version',v_new_version,
  'sort_order',p_order,'changed',true,'notified',v_notified);
end $$;
revoke all on function public.set_essential_published_mission_order(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.set_essential_published_mission_order(uuid,uuid,integer,integer) to authenticated;
