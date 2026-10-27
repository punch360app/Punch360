-- MISSION-007: distinct no photo, optional photo and required photo choices.
alter table private.essential_mission_settings
 add column completion_photo_optional boolean not null default false,
 add constraint essential_mission_photo_policy_consistent check(not (completion_photo_optional and completion_photo_required));
create function public.set_essential_mission_photo_mode(p_company uuid,p_mode text)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare old_mode text;new_required boolean;new_optional boolean;
begin
 if not private.essential_mission_manager(p_company)
 then raise exception using errcode='42501',message='Politique photo réservée au responsable';end if;
 if p_mode is null or p_mode not in ('none','optional','required')
 then raise exception using errcode='22023',message='Choisissez aucune, facultative ou obligatoire';end if;
 new_required:=p_mode='required';new_optional:=p_mode='optional';
 select case when completion_photo_required then 'required' when completion_photo_optional then 'optional' else 'none' end
 into old_mode from private.essential_mission_settings where company_id=p_company for update;
 if not found then
  insert into private.essential_mission_settings(company_id,enabled,updated_by,completion_photo_required,completion_photo_optional)
  values(p_company,false,auth.uid(),new_required,new_optional);
 else
  update private.essential_mission_settings set completion_photo_required=new_required,
   completion_photo_optional=new_optional,updated_by=auth.uid(),updated_at=clock_timestamp()
  where company_id=p_company;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_photo_policy',p_company,
  jsonb_build_object('mode',coalesce(old_mode,'none')),
  jsonb_build_object('mode',p_mode),
  'Aucune, photo facultative ou photo obligatoire; pointage inchangé');
 return jsonb_build_object('photo_required',new_required,'photo_optional',new_optional,'mode',p_mode);
end $fn$;
create or replace function public.set_essential_mission_photo_policy(p_company uuid,p_required boolean)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
begin
 if p_required is null then raise exception using errcode='22023',message='Choix de photo requis';end if;
 return public.set_essential_mission_photo_mode(p_company,case when p_required then 'required' else 'none' end);
end $fn$;
revoke all on function public.set_essential_mission_photo_mode(uuid,text) from public,anon;
grant execute on function public.set_essential_mission_photo_mode(uuid,text) to authenticated;
CREATE OR REPLACE FUNCTION public.essential_missions_configuration(p_company uuid, p_enabled boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_enabled boolean;v_comment_required boolean;v_checklist_required boolean;v_checklist_items jsonb;v_photo_required boolean;v_photo_optional boolean;
begin
 if not private.essential_mission_manager(p_company) then
  raise exception using errcode='42501',message='Module Missions réservé au responsable de cette compagnie';
 end if;
 if p_enabled is not null then
  insert into private.essential_mission_settings(company_id,enabled,updated_by)
  values(p_company,p_enabled,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,updated_by=auth.uid(),updated_at=clock_timestamp();
  insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
  values(p_company,auth.uid(),'mission_module_configuration',p_company,
   jsonb_build_object('enabled',p_enabled),'Activation explicite du module Missions (aucun contrat modifié)');
 end if;
 select enabled,completion_comment_required,completion_checklist_required,completion_checklist_items,completion_photo_required,completion_photo_optional
 into v_enabled,v_comment_required,v_checklist_required,v_checklist_items,v_photo_required,v_photo_optional from private.essential_mission_settings where company_id=p_company;
 return jsonb_build_object('enabled',coalesce(v_enabled,false),'manual_only',true,'comment_required',coalesce(v_comment_required,false),
 'photo_required',coalesce(v_photo_required,false),'photo_optional',coalesce(v_photo_optional,false),'checklist_required',coalesce(v_checklist_required,false),'checklist_items',coalesce(v_checklist_items,'[]'::jsonb));
end $function$;


CREATE OR REPLACE FUNCTION public.list_essential_missions(p_company uuid, p_day date, p_worker uuid DEFAULT NULL::uuid, p_include_drafts boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_manager boolean;v_worker uuid;v_result jsonb;v_count integer;
begin
 if not private.is_member(p_company) or not exists(
  select 1 from public.companies where id=p_company and product_edition='essential'
 ) then raise exception using errcode='42501',message='Missions non autorisées';end if;
 if p_day is null or p_day<current_date-30 or p_day>current_date+180 then
  raise exception using errcode='22023',message='Date de missions invalide';end if;
 v_manager:=private.essential_mission_manager(p_company);
 if not v_manager then
  if coalesce(p_include_drafts,false) then
   raise exception using errcode='42501',message='Brouillons réservés au responsable';end if;
  select id into v_worker from public.company_workers
  where company_id=p_company and auth_user_id=auth.uid() and status='active' and personal_access;
  if v_worker is null or (p_worker is not null and p_worker<>v_worker) then
   raise exception using errcode='42501',message='Compte personnel de mission requis';end if;
 else v_worker:=p_worker;end if;
 if not exists(select 1 from private.essential_mission_settings c where c.company_id=p_company and c.enabled)
 then return jsonb_build_object('enabled',false,'items','[]'::jsonb,'truncated',false);end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order,t.id),'[]'::jsonb),count(*)
 into v_result,v_count from (
  select m.id,m.company_id,m.worker_id,m.site_id,case when m.issue_postponed_from=p_day and m.mission_day<>p_day then p_day else m.mission_day end as mission_day,m.mission_day as effective_day,m.sort_order,m.title,case when m.issue_postponed_from=p_day and m.mission_day<>p_day then 'postponed' else m.status end as status,m.version,
   m.completed_at,m.started_at,case when v_manager and m.status='completed' then m.completion_photo_id else null end as completion_photo_id,case when v_manager then m.completion_comment else null end as completion_comment,
   case when v_manager then m.completion_checklist else null end as completion_checklist,m.issue_reason,m.issue_at,m.issue_decision,m.issue_decision_at,m.issue_decision_reason,m.issue_postponed_from,
   case when v_manager then m.issue_note else null end as issue_note,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and (m.mission_day=p_day or m.issue_postponed_from=p_day) and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','in_progress','completed','impossible') or (m.status='cancelled' and m.issue_decision='cancel'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'comment_required',coalesce((select completion_comment_required from private.essential_mission_settings where company_id=p_company),false),
 'photo_required',coalesce((select completion_photo_required from private.essential_mission_settings where company_id=p_company),false),
 'photo_optional',coalesce((select completion_photo_optional from private.essential_mission_settings where company_id=p_company),false),
 'checklist_required',coalesce((select completion_checklist_required from private.essential_mission_settings where company_id=p_company),false),
 'checklist_items',coalesce((select completion_checklist_items from private.essential_mission_settings where company_id=p_company),'[]'::jsonb),'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;

