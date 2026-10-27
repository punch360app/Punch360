-- MISSION-007/011/013: employee voluntarily STARTS a mission, without starting any Punch.
-- Existing completion and impossible-report RPCs continue to work from both
-- published and in_progress. Never reinterpret this as a paid shift, GPS,
-- absence, payroll event, or a clock punch.
alter table private.essential_missions
 drop constraint essential_missions_status_check,
 add constraint essential_missions_status_check check(
 status in ('draft','published','in_progress','completed','impossible','cancelled')),
 add column started_at timestamptz,
 add column started_by uuid references auth.users(id),
 add constraint essential_mission_started_columns check(
  (started_at is null)=(started_by is null) and (status<>'in_progress' or started_at is not null));
drop index private.essential_missions_unique_published_order;
create unique index essential_missions_unique_published_order
 on private.essential_missions(company_id,worker_id,mission_day,sort_order)
 where status in ('published','in_progress','completed');
create unique index essential_missions_one_active_by_worker
 on private.essential_missions(company_id,worker_id) where status='in_progress';
create table private.essential_mission_starts(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 started_by uuid not null references auth.users(id),
 result_version integer not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
alter table private.essential_mission_starts enable row level security;
revoke all on private.essential_mission_starts from public,anon,authenticated;

create function public.start_essential_mission(
 p_company uuid,p_mission uuid,p_version integer,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare m private.essential_missions;old_version integer;
begin
 if not private.is_member(p_company)
 then raise exception using errcode='42501',message='Compagnie de mission non autorisée';end if;
 if p_mission is null or p_request is null or p_version is null or p_version<1 or
  not exists(select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled)
 then raise exception using errcode='22023',message='Début de mission invalide';end if;
 select * into m from private.essential_missions
 where company_id=p_company and id=p_mission for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 if not exists(select 1 from public.company_workers w
  where w.company_id=p_company and w.id=m.worker_id and w.auth_user_id=auth.uid()
  and w.status='active' and w.personal_access)
 then raise exception using errcode='42501',message='Salarié affecté requis';end if;
 select result_version into old_version from private.essential_mission_starts
  where company_id=p_company and mission_id=p_mission and request_id=p_request and started_by=auth.uid();
 if found then return jsonb_build_object('id',m.id,'version',old_version,'status','in_progress','duplicate',true);end if;
 if m.status<>'published' or m.version<>p_version
 then raise exception using errcode='22023',message='Mission déjà commencée ou modifiée : rechargez';end if;
 if exists(select 1 from private.essential_missions x
  where x.company_id=p_company and x.worker_id=m.worker_id and x.status='in_progress' and x.id<>m.id)
 then raise exception using errcode='22023',message='Terminez ou signalez votre mission en cours avant de commencer une autre';end if;
 update private.essential_missions set status='in_progress',version=version+1,
  started_at=clock_timestamp(),started_by=auth.uid(),updated_at=clock_timestamp(),updated_by=auth.uid()
 where company_id=p_company and id=p_mission returning * into m;
 insert into private.essential_mission_starts(company_id,mission_id,request_id,started_by,result_version)
 values(p_company,p_mission,p_request,auth.uid(),m.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_started',m.id,
  jsonb_build_object('status','published','version',p_version),
  jsonb_build_object('status','in_progress','version',m.version),
  'Début explicite de mission distinct de toute session de pointage, quart et salaire');
 return jsonb_build_object('id',m.id,'version',m.version,'status','in_progress','duplicate',false);
end $fn$;
revoke all on function public.start_essential_mission(uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.start_essential_mission(uuid,uuid,integer,uuid) to authenticated;

-- Extend existing company/employee-authorized operations to the voluntarily started state.
CREATE OR REPLACE FUNCTION public.complete_essential_mission(p_company uuid, p_id uuid, p_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.essential_missions;v_prev integer;v_worker uuid;former_status text;
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Compagnie non autorisée';end if;
 if p_id is null or p_request is null or p_version is null or p_version<=0 or
  not exists(select 1 from private.essential_mission_settings where company_id=p_company and enabled)
 then raise exception using errcode='22023',message='Mission ou demande invalide';end if;
 select * into v from private.essential_missions where company_id=p_company and id=p_id for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select w.id into v_worker from public.company_workers w
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access
  and w.auth_user_id=auth.uid();
 if v_worker is null then raise exception using errcode='42501',message='Seul le salarié affecté peut terminer cette mission';end if;
 select result_version into v_prev from private.essential_mission_completions
  where company_id=p_company and mission_id=p_id and request_id=p_request and completed_by=auth.uid();
 if found then return jsonb_build_object('id',v.id,'version',v_prev,'status','completed','duplicate',true);end if;
 if v.status not in ('published','in_progress') or v.version<>p_version then
  raise exception using errcode='22023',message='Mission modifiée ou déjà terminée. Actualisez la liste.';end if;
 former_status:=v.status;
 update private.essential_missions set status='completed',version=version+1,completed_by=auth.uid(),
  completed_at=clock_timestamp(),updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_completions(company_id,mission_id,request_id,completed_by,result_version)
 values(p_company,p_id,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_completed',v.id,
  jsonb_build_object('version',p_version,'status',former_status),
  jsonb_build_object('version',v.version,'status','completed'),
  'Terminer la mission n’affecte ni la session de pointage ni les heures');
 return jsonb_build_object('id',v.id,'version',v.version,'status','completed','duplicate',false);
end $function$;
CREATE OR REPLACE FUNCTION public.report_essential_mission_issue(p_company uuid, p_mission uuid, p_version integer, p_request uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.essential_missions;v_prev integer;v_worker uuid;former_status text;
begin
 if not private.is_member(p_company) then
  raise exception using errcode='42501',message='Compagnie de mission non autorisée';
 end if;
 if p_mission is null or p_request is null or p_version is null or p_version<=0 or
  p_reason not in ('client_absent','wrong_address','access_blocked','return_needed','other') or
  length(btrim(coalesce(p_note,'')))>300 or
  not exists(select 1 from private.essential_mission_settings c
   where c.company_id=p_company and c.enabled) then
  raise exception using errcode='22023',message='Signalement de mission invalide';
 end if;
 select * into v from private.essential_missions
  where company_id=p_company and id=p_mission for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select id into v_worker from public.company_workers w
  where w.company_id=p_company and w.id=v.worker_id and
   w.auth_user_id=auth.uid() and w.status='active' and w.personal_access;
 if v_worker is null then raise exception using errcode='42501',message='Seul le salarié affecté peut signaler cette mission';end if;
 select result_version into v_prev from private.essential_mission_issue_requests
  where company_id=p_company and mission_id=p_mission and request_id=p_request and reported_by=auth.uid();
 if found then
  return jsonb_build_object('id',v.id,'version',v_prev,'status','impossible','duplicate',true);
 end if;
 if v.status not in ('published','in_progress') or v.version<>p_version then
  raise exception using errcode='22023',message='Mission déjà signalée, terminée ou modifiée; actualisez.';
 end if;
 former_status:=v.status;
 update private.essential_missions set status='impossible',version=version+1,
  issue_reason=p_reason,issue_note=nullif(btrim(coalesce(p_note,'')),''),issue_at=clock_timestamp(),
  issue_by=auth.uid(),issue_decision=null,issue_decision_at=null,issue_decision_by=null,issue_decision_reason=null,issue_postponed_from=null,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_mission returning * into v;
 insert into private.essential_mission_issue_requests(company_id,mission_id,request_id,reported_by,result_version)
 values(p_company,p_mission,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_issue_reported',v.id,
  jsonb_build_object('status',former_status,'version',p_version),
  jsonb_build_object('status','impossible','version',v.version,'reason_code',p_reason),
  'Mission signalée impossible; aucune absence ou sortie de travail inférée');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select p_company,m.user_id,'mission_issue','Mission nécessitant un suivi',
  'Un salarié a signalé une intervention à traiter dans le module Missions.'
 from public.company_members m where m.company_id=p_company and m.status='active'
  and m.role in ('boss','admin') and m.user_id<>auth.uid();
 return jsonb_build_object('id',v.id,'version',v.version,'status','impossible','duplicate',false);
end $function$;
CREATE OR REPLACE FUNCTION public.get_essential_published_mission_details(p_company uuid, p_id uuid, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  and m.status in ('published','in_progress') and m.version=p_version;
 if not found then
  raise exception using errcode='42501',message='Mission introuvable, modifiée ou non publiée pour ce salarié';end if;
 return jsonb_build_object('id',v.id,'version',v.version,
  'title',v.title,'instructions',v.instructions);
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
   m.completed_at,m.started_at,m.issue_reason,m.issue_at,m.issue_decision,m.issue_decision_at,m.issue_decision_reason,m.issue_postponed_from,
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
 return jsonb_build_object('enabled',true,'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;
