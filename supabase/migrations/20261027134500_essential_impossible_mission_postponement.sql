-- MISSION-007/008/011/013: postpone an impossible intervention to a new day,
-- retain its original date as a read-only "reportée" marker, and notify assigned worker.
-- A new public mission is not created; its id and owner remain stable.
alter table private.essential_missions
 drop constraint essential_missions_issue_decision_check,
 add constraint essential_missions_issue_decision_check
  check(issue_decision in ('resume','cancel','postpone')),
 add column issue_postponed_from date;
alter table private.essential_mission_issue_decisions
 drop constraint essential_mission_issue_decisions_decision_check,
 add constraint essential_mission_issue_decisions_decision_check
  check(decision in ('resume','cancel','postpone')),
 add column new_day date,
 add column new_order integer check(new_order between 1 and 999);

create function public.postpone_essential_mission_issue(
 p_company uuid,p_mission uuid,p_version integer,p_request uuid,
 p_day date,p_order integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v private.essential_missions;existing private.essential_mission_issue_decisions;
 worker_auth uuid;old_day date;old_version integer;former_reason text;
begin
 if not private.essential_mission_manager(p_company) or
  not exists(select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled)
 then raise exception using errcode='42501',message='Décision réservée au responsable de la compagnie';end if;
 if p_mission is null or p_request is null or p_version is null or p_version<1 or
  p_day is null or p_order is null or p_order not between 1 and 999 or
  length(btrim(coalesce(p_reason,''))) not between 5 and 200
 then raise exception using errcode='22023',message='Report de mission invalide';end if;
 select * into v from private.essential_missions
 where company_id=p_company and id=p_mission for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select * into existing from private.essential_mission_issue_decisions
 where company_id=p_company and mission_id=p_mission and request_id=p_request;
 if found then
  if existing.manager_id is distinct from auth.uid() or existing.decision<>'postpone' or
   existing.new_day is distinct from p_day or existing.new_order is distinct from p_order
  then raise exception using errcode='42501',message='Confirmation déjà utilisée';end if;
  return jsonb_build_object('id',v.id,'version',existing.result_version,'status','published',
   'decision','postpone','new_day',existing.new_day,'new_order',existing.new_order,'duplicate',true);
 end if;
 if v.status<>'impossible' or v.version<>p_version or v.issue_reason is null
 then raise exception using errcode='22023',message='Mission signalée déjà traitée ou modifiée : rechargez';end if;
 if p_day<=v.mission_day or p_day<current_date or p_day>current_date+180
 then raise exception using errcode='22023',message='Choisissez une journée future admissible';end if;
 if not exists(select 1 from public.company_workers w
   where w.company_id=p_company and w.id=v.worker_id and w.status='active')
 or not exists(select 1 from public.essential_client_sites s
   join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
   where s.company_id=p_company and s.id=v.site_id and s.active and c.active)
 then raise exception using errcode='42501',message='Salarié ou lieu client inactif';end if;
 if exists(select 1 from private.essential_missions m
 where m.company_id=p_company and m.worker_id=v.worker_id and m.mission_day=p_day
 and m.sort_order=p_order and m.id<>v.id and m.status in ('published','completed'))
 then raise exception using errcode='22023',message='Ordre occupé au jour prévu';end if;
 old_day:=v.mission_day;old_version:=v.version;former_reason:=v.issue_reason;
 update private.essential_missions set mission_day=p_day,sort_order=p_order,
  status='published',version=version+1,
  issue_reason=null,issue_note=null,issue_at=null,issue_by=null,
  issue_decision='postpone',issue_decision_reason=btrim(p_reason),
  issue_decision_by=auth.uid(),issue_decision_at=clock_timestamp(),
  issue_postponed_from=old_day,updated_by=auth.uid(),updated_at=clock_timestamp()
 where id=p_mission and company_id=p_company returning * into v;
 insert into private.essential_mission_issue_decisions(
  company_id,mission_id,request_id,manager_id,decision,result_version,new_day,new_order)
 values(p_company,p_mission,p_request,auth.uid(),'postpone',v.version,p_day,p_order);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_issue_postponed',v.id,
  jsonb_build_object('status','impossible','day',old_day,'version',old_version,'reason_code',former_reason),
  jsonb_build_object('status','published','day',p_day,'order',p_order,'version',v.version,'decision','postpone'),
  btrim(p_reason));
 select w.auth_user_id into worker_auth from public.company_workers w
 join public.company_members m on m.company_id=w.company_id and m.user_id=w.auth_user_id and m.status='active'
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access;
 if worker_auth is not null and worker_auth<>auth.uid() then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,worker_auth,'mission_issue_decision','Intervention reportée',
   'Votre intervention est reportée au '||to_char(p_day,'YYYY-MM-DD')||'. Consultez vos missions.');
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'status','published',
  'decision','postpone','new_day',p_day,'new_order',p_order,'duplicate',false,
  'notification_sent',worker_auth is not null and worker_auth<>auth.uid());
end $fn$;
revoke all on function public.postpone_essential_mission_issue(uuid,uuid,integer,uuid,date,integer,text) from public,anon;
grant execute on function public.postpone_essential_mission_issue(uuid,uuid,integer,uuid,date,integer,text) to authenticated;

-- Keep the original issue action fully authorized; a NEW report resets only
-- the latest postponement marker, while history remains in protected audit.
CREATE OR REPLACE FUNCTION public.report_essential_mission_issue(p_company uuid, p_mission uuid, p_version integer, p_request uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.essential_missions;v_prev integer;v_worker uuid;
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
 if v.status<>'published' or v.version<>p_version then
  raise exception using errcode='22023',message='Mission déjà signalée, terminée ou modifiée; actualisez.';
 end if;
 update private.essential_missions set status='impossible',version=version+1,
  issue_reason=p_reason,issue_note=nullif(btrim(coalesce(p_note,'')),''),issue_at=clock_timestamp(),
  issue_by=auth.uid(),issue_decision=null,issue_decision_at=null,issue_decision_by=null,issue_decision_reason=null,issue_postponed_from=null,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_mission returning * into v;
 insert into private.essential_mission_issue_requests(company_id,mission_id,request_id,reported_by,result_version)
 values(p_company,p_mission,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_issue_reported',v.id,
  jsonb_build_object('status','published','version',p_version),
  jsonb_build_object('status','impossible','version',v.version,'reason_code',p_reason),
  'Mission signalée impossible; aucune absence ou sortie de travail inférée');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select p_company,m.user_id,'mission_issue','Mission nécessitant un suivi',
  'Un salarié a signalé une intervention à traiter dans le module Missions.'
 from public.company_members m where m.company_id=p_company and m.status='active'
  and m.role in ('boss','admin') and m.user_id<>auth.uid();
 return jsonb_build_object('id',v.id,'version',v.version,'status','impossible','duplicate',false);
end $function$;

-- Authorization and 200-item response remain unchanged. A postponed mission
-- is only a historical projection on the *old* day, never a navigable task.
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
   m.completed_at,m.issue_reason,m.issue_at,m.issue_decision,m.issue_decision_at,m.issue_decision_reason,m.issue_postponed_from,
   case when v_manager then m.issue_note else null end as issue_note,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and (m.mission_day=p_day or m.issue_postponed_from=p_day) and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','completed','impossible') or (m.status='cancelled' and m.issue_decision='cancel'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;
