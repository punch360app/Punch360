-- MISSION-007/011/013: configurable checklist completion proof, pure local controls.
-- No photo storage, biometrics, tokens, paid AI, QR or GPS. No existing policy changes.
create function private.essential_mission_checklist_valid(p_items jsonb)
 returns boolean language plpgsql immutable set search_path='' as $fn$
declare v text;observed text[]:='{}';n integer;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' then return false;end if;
 n:=jsonb_array_length(p_items);
 if n>8 then return false;end if;
 for v in select jsonb_array_elements_text(p_items) loop
  if length(v)<3 or length(v)>120 or v<>btrim(v) or v~'[[:cntrl:]]' or lower(v)=any(observed)
  then return false;end if;
  observed:=array_append(observed,lower(v));
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'string')
 then return false;end if;
 return true;
end $fn$;
revoke all on function private.essential_mission_checklist_valid(jsonb) from public,anon,authenticated;

alter table private.essential_mission_settings
 add column completion_checklist_required boolean not null default false,
 add column completion_checklist_items jsonb not null default '[]'::jsonb,
 add constraint essential_mission_checklist_policy_valid check (
  private.essential_mission_checklist_valid(completion_checklist_items)
  and (not completion_checklist_required or jsonb_array_length(completion_checklist_items)>0)
 );
alter table private.essential_missions
 add column completion_checklist jsonb,
 add constraint essential_mission_completed_checklist_valid check(
  completion_checklist is null or private.essential_mission_checklist_valid(completion_checklist)
 );

create function public.set_essential_mission_checklist_policy(
 p_company uuid,p_required boolean,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare old_required boolean;old_count integer;
begin
 if not private.essential_mission_manager(p_company)
 then raise exception using errcode='42501',message='Checklist réservée au responsable de cette compagnie';end if;
 if p_required is null or not private.essential_mission_checklist_valid(p_items) or
  (p_required and jsonb_array_length(p_items)=0)
 then raise exception using errcode='22023',message='Checklist invalide : 1 à 8 étapes de 3 à 120 caractères';end if;
 select completion_checklist_required,jsonb_array_length(completion_checklist_items)
  into old_required,old_count
  from private.essential_mission_settings where company_id=p_company for update;
 if not found then
  insert into private.essential_mission_settings(company_id,enabled,updated_by,completion_checklist_required,completion_checklist_items)
  values(p_company,false,auth.uid(),p_required,p_items);
 else
  update private.essential_mission_settings set completion_checklist_required=p_required,
   completion_checklist_items=p_items,updated_by=auth.uid(),updated_at=clock_timestamp()
  where company_id=p_company;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_checklist_policy',p_company,
  jsonb_build_object('required',coalesce(old_required,false),'item_count',coalesce(old_count,0)),
  jsonb_build_object('required',p_required,'item_count',jsonb_array_length(p_items)),
  'Checklist de fin de mission : confirmation volontaire des étapes autorisées');
 return jsonb_build_object('checklist_required',p_required,'checklist_items',p_items);
end $fn$;
revoke all on function public.set_essential_mission_checklist_policy(uuid,boolean,jsonb) from public,anon;
grant execute on function public.set_essential_mission_checklist_policy(uuid,boolean,jsonb) to authenticated;

-- Canonical completion V3. Lock the current company proof policy; no previous
-- client RPC can bypass a newly required checklist.
CREATE OR REPLACE FUNCTION public.complete_essential_mission_v3(p_company uuid, p_id uuid, p_version integer, p_request uuid, p_comment text, p_checklist jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.essential_missions;v_prev integer;v_worker uuid;former_status text;
 required boolean;proof text;checklist_required boolean;checklist_items jsonb;
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Compagnie non autorisée';end if;
 if p_id is null or p_request is null or p_version is null or p_version<=0 or
  not exists(select 1 from private.essential_mission_settings where company_id=p_company and enabled)
 then raise exception using errcode='22023',message='Mission ou demande invalide';end if;
 select * into v from private.essential_missions where company_id=p_company and id=p_id for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select id into v_worker from public.company_workers w
  where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access and w.auth_user_id=auth.uid();
 if v_worker is null then raise exception using errcode='42501',message='Seul le salarié affecté peut terminer cette mission';end if;
 select result_version into v_prev from private.essential_mission_completions
  where company_id=p_company and mission_id=p_id and request_id=p_request and completed_by=auth.uid();
 if found then return jsonb_build_object('id',v.id,'version',v_prev,'status','completed','duplicate',true);end if;
 if v.status not in ('published','in_progress') or v.version<>p_version then
  raise exception using errcode='22023',message='Mission modifiée ou déjà terminée : actualisez la liste';end if;
 select completion_comment_required,completion_checklist_required,completion_checklist_items
  into required,checklist_required,checklist_items from private.essential_mission_settings
  where company_id=p_company for share;
 proof:=nullif(btrim(coalesce(p_comment,'')),'');
 if (coalesce(required,false) and (proof is null or length(proof)<5)) or
  (proof is not null and length(proof)>1000)
 then raise exception using errcode='22023',
  message='Commentaire de fin de mission requis (5 à 1000 caractères)';end if;
 if coalesce(checklist_required,false) and (p_checklist is null or p_checklist<>checklist_items)
 then raise exception using errcode='22023',
  message='Toutes les étapes de la checklist doivent être confirmées; actualisez la liste';end if;
 former_status:=v.status;
 update private.essential_missions set status='completed',version=version+1,
  completed_by=auth.uid(),completed_at=clock_timestamp(),completion_comment=proof,
  completion_checklist=case when coalesce(checklist_required,false) then checklist_items else null end,
  updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_completions(company_id,mission_id,request_id,completed_by,result_version)
 values(p_company,p_id,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_completed',v.id,
  jsonb_build_object('version',p_version,'status',former_status),
  jsonb_build_object('version',v.version,'status','completed','proof_type',case when proof is not null then 'comment' else 'none' end,
   'checklist_confirmed',coalesce(checklist_required,false)),
  'Preuve de fin privée; aucune conséquence sur pointage, quart, heures, paie ou GPS');
 return jsonb_build_object('id',v.id,'version',v.version,'status','completed','duplicate',false,
  'proof_saved',proof is not null or coalesce(checklist_required,false),
  'checklist_saved',coalesce(checklist_required,false));
end $function$;
create or replace function public.complete_essential_mission_v2(
 p_company uuid,p_id uuid,p_version integer,p_request uuid,p_comment text
) returns jsonb language sql security definer set search_path='' as $fn$
 select public.complete_essential_mission_v3(p_company,p_id,p_version,p_request,p_comment,null::jsonb)
$fn$;
revoke all on function public.complete_essential_mission_v3(uuid,uuid,integer,uuid,text,jsonb),
 public.complete_essential_mission_v2(uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.complete_essential_mission_v3(uuid,uuid,integer,uuid,text,jsonb),
 public.complete_essential_mission_v2(uuid,uuid,integer,uuid,text) to authenticated;

-- Authorized configuration, worker list, private manager-only proof projection.
CREATE OR REPLACE FUNCTION public.essential_missions_configuration(p_company uuid, p_enabled boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_enabled boolean;v_comment_required boolean;v_checklist_required boolean;v_checklist_items jsonb;
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
 select enabled,completion_comment_required,completion_checklist_required,completion_checklist_items
 into v_enabled,v_comment_required,v_checklist_required,v_checklist_items from private.essential_mission_settings where company_id=p_company;
 return jsonb_build_object('enabled',coalesce(v_enabled,false),'manual_only',true,'comment_required',coalesce(v_comment_required,false),
 'checklist_required',coalesce(v_checklist_required,false),'checklist_items',coalesce(v_checklist_items,'[]'::jsonb));
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
   m.completed_at,m.started_at,case when v_manager then m.completion_comment else null end as completion_comment,
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
 'checklist_required',coalesce((select completion_checklist_required from private.essential_mission_settings where company_id=p_company),false),
 'checklist_items',coalesce((select completion_checklist_items from private.essential_mission_settings where company_id=p_company),'[]'::jsonb),'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;
