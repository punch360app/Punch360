-- MISSION-007: employee-reported impossible mission; not an absence or Punch OUT.
-- Explicit reason is stored privately. Notifications reveal no reason or access code.
alter table private.essential_missions
 drop constraint essential_missions_status_check,
 add constraint essential_missions_status_check
  check(status in ('draft','published','completed','impossible','cancelled'));
alter table private.essential_missions
 add column issue_reason text,
 add column issue_note text,
 add column issue_at timestamptz,
 add column issue_by uuid references auth.users(id),
 add constraint essential_mission_issue_valid check(
  (status='impossible') =
    (issue_reason is not null and issue_at is not null and issue_by is not null)
 ),
 add constraint essential_mission_issue_note_bound check(length(coalesce(issue_note,''))<=300),
 add constraint essential_mission_issue_reason_valid check(
   issue_reason is null or issue_reason in
   ('client_absent','wrong_address','access_blocked','return_needed','other')
 );

create table private.essential_mission_issue_requests(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 reported_by uuid not null references auth.users(id),
 result_version integer not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
alter table private.essential_mission_issue_requests enable row level security;
revoke all on private.essential_mission_issue_requests from public,anon,authenticated;

create function public.report_essential_mission_issue(
 p_company uuid,p_mission uuid,p_version integer,p_request uuid,
 p_reason text,p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
  issue_by=auth.uid(),updated_by=auth.uid(),updated_at=clock_timestamp()
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
end $$;

-- Existing list becomes issue-aware while still omitting private notes for coworkers.
create or replace function public.list_essential_missions(
 p_company uuid,p_day date,p_worker uuid default null,p_include_drafts boolean default false
) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
   m.completed_at,m.issue_reason,m.issue_at,
   case when v_manager then m.issue_note else null end as issue_note,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and m.mission_day=p_day and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','completed','impossible'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $$;
revoke all on function public.report_essential_mission_issue(uuid,uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.report_essential_mission_issue(uuid,uuid,integer,uuid,text,text) to authenticated;
