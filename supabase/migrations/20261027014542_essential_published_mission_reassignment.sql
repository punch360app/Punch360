-- MISSION-008 partial: explicit, idempotent manager reassignment of a published mission.
-- Applied to exclusive Supabase mlabstdxxwjdpfaxiwmg as 20261027014542.
-- This does not change punches, shifts, payroll, client addresses or GPS.
create table private.essential_mission_reassign_requests(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 actor_id uuid not null references auth.users(id),
 target_worker uuid not null,
 target_order integer not null check(target_order between 1 and 999),
 result_version integer not null check(result_version>0),
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id),
 foreign key(company_id,target_worker) references public.company_workers(company_id,id)
);
alter table private.essential_mission_reassign_requests enable row level security;
revoke all on private.essential_mission_reassign_requests from public,anon,authenticated;

create function public.reassign_essential_published_mission(
 p_company uuid,p_id uuid,p_version integer,p_request uuid,
 p_target_worker uuid,p_target_order integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_old_worker uuid;v_old_order integer;
 v_old_version integer;v_reason text;v_previous record;
 v_old_user uuid;v_new_user uuid;
begin
 if not private.essential_mission_manager(p_company) or not exists(
  select 1 from private.essential_mission_settings s where s.company_id=p_company and s.enabled
 ) then raise exception using errcode='42501',message='Réaffectation réservée au Boss/Admin autorisé';end if;
 v_reason:=btrim(coalesce(p_reason,''));
 if p_id is null or p_version is null or p_version<1 or p_request is null
  or p_target_worker is null or p_target_order not between 1 and 999
  or length(v_reason) not between 5 and 200 then
  raise exception using errcode='22023',message='Mission, version, salarié, ordre ou motif invalide';end if;
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('mission_route_swap:'||p_company::text,0));
 select * into v from private.essential_missions
  where company_id=p_company and id=p_id for update;
 if not found then
  raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select target_worker,target_order,result_version into v_previous
 from private.essential_mission_reassign_requests
 where company_id=p_company and mission_id=p_id and request_id=p_request and actor_id=auth.uid();
 if found then
  if v_previous.target_worker<>p_target_worker or v_previous.target_order<>p_target_order then
   raise exception using errcode='22023',message='Cette demande a déjà été utilisée pour une autre réaffectation';end if;
  return jsonb_build_object('id',v.id,'version',v_previous.result_version,
   'worker_id',p_target_worker,'sort_order',p_target_order,'status','published','duplicate',true);
 end if;
 if v.status<>'published' or v.version<>p_version
  or v.mission_day<current_date-7 or v.mission_day>current_date+180 then
  raise exception using errcode='22023',message='Mission modifiée ou déjà traitée : actualisez la tournée';end if;
 if v.worker_id=p_target_worker then
  raise exception using errcode='22023',message='Choisissez un autre salarié pour réaffecter cette mission';end if;
 if not exists(select 1 from public.company_workers w
  where w.company_id=p_company and w.id=p_target_worker and w.status='active') then
  raise exception using errcode='42501',message='Le nouveau salarié est inactif ou extérieur à la compagnie';end if;
 if exists(select 1 from private.essential_missions m
  where m.company_id=p_company and m.worker_id=p_target_worker and m.mission_day=v.mission_day
   and m.sort_order=p_target_order and m.status in ('published','completed')) then
  raise exception using errcode='22023',message='Ce rang est déjà occupé dans la tournée du nouveau salarié';end if;
 v_old_worker:=v.worker_id;v_old_order:=v.sort_order;v_old_version:=v.version;
 update private.essential_missions set worker_id=p_target_worker,sort_order=p_target_order,
  version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_reassign_requests(
  company_id,mission_id,request_id,actor_id,target_worker,target_order,result_version)
 values(p_company,p_id,p_request,auth.uid(),p_target_worker,p_target_order,v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'published_mission_reassigned',v.id,
  jsonb_build_object('worker_id',v_old_worker,'sort_order',v_old_order,'version',v_old_version),
  jsonb_build_object('worker_id',v.worker_id,'sort_order',v.sort_order,'version',v.version),v_reason);
 select w.auth_user_id into v_old_user from public.company_workers w join public.company_members cm
  on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
  where w.company_id=p_company and w.id=v_old_worker and w.status='active' and w.personal_access;
 select w.auth_user_id into v_new_user from public.company_workers w join public.company_members cm
  on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
  where w.company_id=p_company and w.id=p_target_worker and w.status='active' and w.personal_access;
 if v_old_user is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_old_user,'mission_published','Mission réaffectée',
   'Une intervention du '||pg_catalog.to_char(v.mission_day,'YYYY-MM-DD')||
   ' a été confiée à un autre salarié. Consultez votre tournée actualisée.');
 end if;
 if v_new_user is not null and v_new_user is distinct from v_old_user then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_new_user,'mission_published','Nouvelle intervention',
   'Une intervention du '||pg_catalog.to_char(v.mission_day,'YYYY-MM-DD')||
   ' vous a été attribuée. Consultez votre tournée actualisée.');
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'worker_id',v.worker_id,
  'sort_order',v.sort_order,'status','published','duplicate',false,
  'notified_old',v_old_user is not null,'notified_new',v_new_user is not null and v_new_user is distinct from v_old_user);
end $$;
revoke all on function public.reassign_essential_published_mission(uuid,uuid,integer,uuid,uuid,integer,text)
 from public,anon;
grant execute on function public.reassign_essential_published_mission(uuid,uuid,integer,uuid,uuid,integer,text)
 to authenticated;
