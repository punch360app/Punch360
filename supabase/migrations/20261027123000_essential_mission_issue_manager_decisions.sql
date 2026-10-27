-- MISSION-007 / 011 / 013: manager decision on worker-reported impossible mission.
-- Two explicit dispositions: resume published assignment or cancel after review.
-- Any action is versioned, company-scoped, idempotent and separate from payroll,
-- shifts, punch sessions, GPS, route distance and invoices.
alter table private.essential_missions
 add column issue_decision text check (issue_decision in ('resume','cancel')),
 add column issue_decision_at timestamptz,
 add column issue_decision_by uuid references auth.users(id),
 add column issue_decision_reason text check (length(btrim(issue_decision_reason)) between 5 and 200),
 add constraint essential_mission_issue_decision_complete check (
  (issue_decision is null and issue_decision_at is null and issue_decision_by is null and issue_decision_reason is null)
  or (issue_decision is not null and issue_decision_at is not null and issue_decision_by is not null and issue_decision_reason is not null)
 );
create table private.essential_mission_issue_decisions(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 manager_id uuid not null references auth.users(id),
 decision text not null check(decision in ('resume','cancel')),
 result_version integer not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
alter table private.essential_mission_issue_decisions enable row level security;
revoke all on private.essential_mission_issue_decisions from public,anon,authenticated;

create function public.resolve_essential_mission_issue(
 p_company uuid,p_mission uuid,p_version integer,p_request uuid,p_decision text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v private.essential_missions;prior private.essential_mission_issue_decisions;
 worker_auth uuid;former_reason text;old_version integer;new_status text;
begin
 if not private.essential_mission_manager(p_company)
  or not exists(select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled)
 then raise exception using errcode='42501',message='Décision réservée au responsable de cette compagnie';end if;
 if p_mission is null or p_request is null or p_version is null or p_version<1
  or p_decision is null or p_decision not in ('resume','cancel')
  or length(btrim(coalesce(p_reason,''))) not between 5 and 200
 then raise exception using errcode='22023',message='Décision, motif ou confirmation invalide';end if;
 select * into v from private.essential_missions where company_id=p_company and id=p_mission for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select * into prior from private.essential_mission_issue_decisions
 where company_id=p_company and mission_id=p_mission and request_id=p_request;
 if found then
  if prior.manager_id is distinct from auth.uid() or prior.decision is distinct from p_decision
   then raise exception using errcode='42501',message='Confirmation de décision déjà utilisée';end if;
  return jsonb_build_object('id',v.id,'version',prior.result_version,
    'decision',prior.decision,'status',case when prior.decision='resume' then 'published' else 'cancelled' end,
    'duplicate',true);
 end if;
 if v.status<>'impossible' or v.version<>p_version or v.issue_reason is null
 then raise exception using errcode='22023',message='Signalement déjà traité ou mission modifiée : actualisez';end if;
 if p_decision='resume' and exists(
  select 1 from private.essential_missions other
  where other.company_id=p_company and other.worker_id=v.worker_id
   and other.mission_day=v.mission_day and other.sort_order=v.sort_order
   and other.id<>v.id and other.status in ('published','completed')
 ) then raise exception using errcode='22023',
  message='Rang de mission occupé : reprogrammez la tournée avant de reprendre';end if;
 former_reason:=v.issue_reason;old_version:=v.version;
 new_status:=case when p_decision='resume' then 'published' else 'cancelled' end;
 update private.essential_missions set
  status=new_status,version=version+1,
  issue_decision=p_decision,issue_decision_at=clock_timestamp(),issue_decision_by=auth.uid(),
  issue_decision_reason=btrim(p_reason),
  issue_reason=null,issue_note=null,issue_at=null,issue_by=null,
  updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_mission returning * into v;
 insert into private.essential_mission_issue_decisions(company_id,mission_id,request_id,manager_id,decision,result_version)
 values(p_company,p_mission,p_request,auth.uid(),p_decision,v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_issue_resolved',v.id,
  jsonb_build_object('status','impossible','version',old_version,'reason_code',former_reason),
  jsonb_build_object('status',new_status,'version',v.version,'decision',p_decision),
  btrim(p_reason));
 select w.auth_user_id into worker_auth
 from public.company_workers w join public.company_members cm
  on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access;
 if worker_auth is not null and worker_auth<>auth.uid() then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,worker_auth,'mission_issue_decision','Décision concernant votre intervention',
   case when p_decision='resume'
   then 'Votre mission a été remise à faire. Consultez la tournée de votre entreprise.'
   else 'Votre mission signalée a été annulée après examen. Consultez votre suivi.'
   end);
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'status',new_status,
  'decision',p_decision,'duplicate',false,'notification_sent',worker_auth is not null and worker_auth<>auth.uid());
end $fn$;
revoke all on function public.resolve_essential_mission_issue(uuid,uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.resolve_essential_mission_issue(uuid,uuid,integer,uuid,text,text) to authenticated;

-- Keep the existing company/worker/draft permissions and 200-row limit.
-- A canceled mission only appears to its assigned employee when it resulted
-- from a manager decision; other canceled missions stay hidden as before.
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
  select m.id,m.company_id,m.worker_id,m.site_id,m.mission_day,m.sort_order,m.title,m.status,m.version,
   m.completed_at,m.issue_reason,m.issue_at,m.issue_decision,m.issue_decision_at,m.issue_decision_reason,
   case when v_manager then m.issue_note else null end as issue_note,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and m.mission_day=p_day and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','completed','impossible') or (m.status='cancelled' and m.issue_decision='cancel'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;
