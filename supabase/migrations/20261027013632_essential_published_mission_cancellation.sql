-- MISSION-008 (partial): cancel only a still-published mission, by an authorized manager.
-- Adds an idempotent audit/notification path; does not mutate time, pay, shifts or GPS.
create table private.essential_mission_cancellation_requests(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 cancelled_by uuid not null references auth.users(id),
 result_version integer not null check(result_version>0),
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
alter table private.essential_mission_cancellation_requests enable row level security;
revoke all on private.essential_mission_cancellation_requests from public,anon,authenticated;

create function public.cancel_essential_published_mission(
 p_company uuid,p_id uuid,p_version integer,p_request uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_previous integer;v_recipient uuid;v_reason text;
begin
 if not private.essential_mission_manager(p_company) or not exists(
  select 1 from private.essential_mission_settings where company_id=p_company and enabled
 ) then raise exception using errcode='42501',message='Annulation réservée au Boss/Admin autorisé';end if;
 v_reason:=btrim(coalesce(p_reason,''));
 if p_id is null or p_version is null or p_version<1 or p_request is null
  or length(v_reason) not between 5 and 200 then
  raise exception using errcode='22023',message='Mission, version, demande ou motif invalide';end if;
 select * into v from private.essential_missions where company_id=p_company and id=p_id for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select result_version into v_previous from private.essential_mission_cancellation_requests
 where company_id=p_company and mission_id=p_id and request_id=p_request and cancelled_by=auth.uid();
 if found then return jsonb_build_object('id',v.id,'version',v_previous,'status','cancelled','duplicate',true);end if;
 if v.status<>'published' or v.version<>p_version or v.mission_day<current_date-7
   or v.mission_day>current_date+180 then
  raise exception using errcode='22023',
   message='Mission terminée, signalée ou modifiée : actualisez avant annulation';end if;
 update private.essential_missions
 set status='cancelled',version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_cancellation_requests(
  company_id,mission_id,request_id,cancelled_by,result_version)
 values(p_company,p_id,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'published_mission_cancelled',v.id,
  jsonb_build_object('version',p_version,'status','published'),
  jsonb_build_object('version',v.version,'status','cancelled'),v_reason);
 select w.auth_user_id into v_recipient
 from public.company_workers w join public.company_members cm
  on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
 where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access;
 if v_recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_recipient,'mission_published','Intervention annulée',
   'Une mission de votre journée du '||pg_catalog.to_char(v.mission_day,'YYYY-MM-DD')||
   ' a été annulée par votre responsable. Ouvrez la tournée actualisée.');
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'status','cancelled',
  'duplicate',false,'notified',v_recipient is not null);
end $$;
revoke all on function public.cancel_essential_published_mission(uuid,uuid,integer,uuid,text)
 from public,anon;
grant execute on function public.cancel_essential_published_mission(uuid,uuid,integer,uuid,text)
 to authenticated;
