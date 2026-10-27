-- MISSION-008 partial: Boss/Admin explicitly moves a published mission to another date/site/rank.
-- Company-scoped, versioned and idempotent; does not write punches, shifts, GPS or payroll.
create table private.essential_mission_reschedule_requests(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 actor_id uuid not null references auth.users(id),
 target_day date not null,
 target_site uuid not null,
 target_order integer not null check(target_order between 1 and 999),
 reason text not null,
 result_version integer not null check(result_version>0),
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id),
 foreign key(company_id,target_site) references public.essential_client_sites(company_id,id)
);
alter table private.essential_mission_reschedule_requests enable row level security;
revoke all on private.essential_mission_reschedule_requests from public,anon,authenticated;

create function public.reschedule_essential_published_mission(
 p_company uuid,p_id uuid,p_version integer,p_request uuid,
 p_target_day date,p_target_site uuid,p_target_order integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_previous private.essential_missions;
 v_request record;v_reason text;v_recipient uuid;
begin
 if auth.uid() is null or not private.essential_mission_manager(p_company) or not exists(
  select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled
 ) then raise exception using errcode='42501',message='Reprogrammation réservée au Boss/Admin autorisé';end if;
 v_reason:=btrim(coalesce(p_reason,''));
 if p_id is null or p_version is null or p_version<1 or p_request is null or
  p_target_day is null or p_target_day<current_date or p_target_day>current_date+180 or
  p_target_site is null or p_target_order is null or p_target_order not between 1 and 999 or
  length(v_reason) not between 5 and 200 then
  raise exception using errcode='22023',message='Date, lieu, rang, version ou motif invalide';end if;
 -- Shared company route lock with reorder/reassignment, then row-version check.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('mission_route_swap:'||p_company::text,0));
 select * into v from private.essential_missions
  where company_id=p_company and id=p_id for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select target_day,target_site,target_order,reason,result_version into v_request
 from private.essential_mission_reschedule_requests
 where company_id=p_company and mission_id=p_id and request_id=p_request and actor_id=auth.uid();
 if found then
  if v_request.target_day<>p_target_day or v_request.target_site<>p_target_site or
   v_request.target_order<>p_target_order or v_request.reason<>v_reason then
   raise exception using errcode='22023',message='Demande déjà utilisée pour une autre reprogrammation';end if;
  return jsonb_build_object('id',v.id,'version',v_request.result_version,'status','published','duplicate',true);
 end if;
 if v.status<>'published' or v.version<>p_version or v.mission_day<current_date-7
  or v.mission_day>current_date+180 then
  raise exception using errcode='22023',message='Mission modifiée ou déjà traitée : actualisez la journée';end if;
 if v.mission_day=p_target_day and v.site_id=p_target_site and v.sort_order=p_target_order then
  raise exception using errcode='22023',message='Aucune modification de mission à publier';end if;
 if not exists(select 1 from public.essential_client_sites s
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  where s.company_id=p_company and s.id=p_target_site and s.active and c.active) then
  raise exception using errcode='42501',message='Adresse client inactive ou extérieure à la compagnie';end if;
 if exists(select 1 from private.essential_missions m
  where m.company_id=p_company and m.id<>p_id and m.worker_id=v.worker_id and
  m.mission_day=p_target_day and m.sort_order=p_target_order and m.status in ('published','completed')) then
  raise exception using errcode='22023',message='Rang déjà occupé pour ce salarié et cette journée';end if;
 v_previous:=v;
 update private.essential_missions set mission_day=p_target_day,site_id=p_target_site,sort_order=p_target_order,
  version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_reschedule_requests(
  company_id,mission_id,request_id,actor_id,target_day,target_site,target_order,reason,result_version)
 values(p_company,p_id,p_request,auth.uid(),p_target_day,p_target_site,p_target_order,v_reason,v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'published_mission_rescheduled',v.id,
  jsonb_build_object('mission_day',v_previous.mission_day,'site_id',v_previous.site_id,
   'sort_order',v_previous.sort_order,'version',v_previous.version),
  jsonb_build_object('mission_day',v.mission_day,'site_id',v.site_id,
   'sort_order',v.sort_order,'version',v.version),v_reason);
 select w.auth_user_id into v_recipient from public.company_workers w
 join public.company_members cm on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access;
 if v_recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_recipient,'mission_published','Intervention reprogrammée',
   'Une mission a été déplacée au '||pg_catalog.to_char(v.mission_day,'YYYY-MM-DD')||
   '. Consultez la tournée et la nouvelle adresse.');
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'status','published',
  'mission_day',v.mission_day,'site_id',v.site_id,'sort_order',v.sort_order,
  'duplicate',false,'notified',v_recipient is not null);
end $$;
revoke all on function public.reschedule_essential_published_mission(uuid,uuid,integer,uuid,date,uuid,integer,text)
 from public,anon;
grant execute on function public.reschedule_essential_published_mission(uuid,uuid,integer,uuid,date,uuid,integer,text)
 to authenticated;
