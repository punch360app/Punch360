-- MISSION-001/002/003/004/005/006/013, limited initial Plus/Pro route.
-- A mission is a task, NEVER an attendance session, punch segment, GPS, route or wage.
create table private.essential_mission_settings(
 company_id uuid primary key references public.companies(id),
 enabled boolean not null default false,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);
alter table private.essential_mission_settings enable row level security;
revoke all on private.essential_mission_settings from public,anon,authenticated;
create table private.essential_missions(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 worker_id uuid not null,
 client_site_id uuid not null,
 shift_id uuid,
 service_day date not null,
 sort_rank integer not null check(sort_rank between 1 and 200),
 title text not null check(length(btrim(title)) between 2 and 160),
 planned_minutes integer check(planned_minutes between 1 and 1440),
 proof_mode text not null default 'none' check(proof_mode in ('none','comment')),
 status text not null default 'draft' check(status in ('draft','published','completed','cancelled')),
 version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 published_at timestamptz,
 completed_at timestamptz,
 completion_request uuid,
 completion_note text not null default '' check(length(completion_note)<=500),
 completed_by uuid references auth.users(id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 foreign key(company_id,client_site_id) references public.essential_client_sites(company_id,id),
 foreign key(company_id,shift_id) references public.scheduled_shifts(company_id,id)
);
create unique index essential_mission_slot on private.essential_missions(company_id,worker_id,service_day,sort_rank)
 where status<>'cancelled';
create unique index essential_mission_completion_request on private.essential_missions(company_id,completion_request)
 where completion_request is not null;
create index essential_mission_day on private.essential_missions(company_id,service_day,status,worker_id,sort_rank);
alter table private.essential_missions enable row level security;
revoke all on private.essential_missions from public,anon,authenticated;

create function private.essential_missions_entitled(p_company uuid)
 returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.companies c where c.id=p_company and c.product_edition='essential')
 and private.essential_feature(p_company,'advanced_schedules')
$$;
revoke all on function private.essential_missions_entitled(uuid) from public,anon,authenticated;

create function public.set_essential_missions_enabled(p_company uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v boolean;
begin
 if p_enabled is null or auth.uid() is null or not private.is_manager(p_company) or
 not private.essential_missions_entitled(p_company) then
 raise exception using errcode='42501',message='Activation des missions réservée au responsable Plus/Pro';end if;
 insert into private.essential_mission_settings(company_id,enabled,updated_by)
 values(p_company,p_enabled,auth.uid())
 on conflict(company_id) do update set enabled=excluded.enabled,
  updated_by=excluded.updated_by,updated_at=clock_timestamp();
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'essential_missions_activation',p_company,
  jsonb_build_object('enabled',p_enabled),'Missions et tournées : sans effet sur les quarts ni les pointages');
 return jsonb_build_object('enabled',p_enabled);
end $$;

create function public.save_essential_mission(
 p_company uuid,p_id uuid,p_expected_version integer,p_worker uuid,p_client_site uuid,
 p_shift uuid,p_day date,p_rank integer,p_title text,p_minutes integer,p_proof_mode text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m private.essential_missions;z text;sh public.scheduled_shifts;
begin
 if auth.uid() is null or not private.is_manager(p_company) or
 not private.essential_missions_entitled(p_company) or
 not exists(select 1 from private.essential_mission_settings a where a.company_id=p_company and a.enabled)
 then raise exception using errcode='42501',message='Missions non activées pour cette compagnie';end if;
 select s.timezone into z from public.essential_client_sites s
 join public.essential_clients c on c.id=s.client_id and c.company_id=s.company_id and c.active
 where s.company_id=p_company and s.id=p_client_site and s.active;
 if not found or not exists(select 1 from public.company_workers w
 where w.company_id=p_company and w.id=p_worker and w.status='active') then
 raise exception using errcode='42501',message='Salarié et adresse client actifs de cette compagnie requis';end if;
 if p_day is null or p_day<((clock_timestamp() at time zone z)::date)-7 or
 p_day>((clock_timestamp() at time zone z)::date)+90 or
 p_rank is null or p_rank not between 1 and 200 or
 char_length(btrim(coalesce(p_title,''))) not between 2 and 160 or
 (p_minutes is not null and p_minutes not between 1 and 1440) or
 p_proof_mode not in ('none','comment') or p_expected_version is null or p_expected_version<0 then
 raise exception using errcode='22023',message='Données de mission ou horizon invalides';end if;
 if p_shift is not null then
  select * into sh from public.scheduled_shifts where company_id=p_company and id=p_shift;
  if not found or sh.cancelled_at is not null or sh.worker_id is distinct from p_worker or
    (sh.starts_at at time zone z)::date<>p_day then
   raise exception using errcode='42501',message='Quart publié du même salarié et du même jour requis';end if;
 end if;
 if p_id is null then
  if p_expected_version<>0 then raise exception using errcode='22023',message='Nouvelle mission : version 0';end if;
  insert into private.essential_missions(company_id,worker_id,client_site_id,shift_id,service_day,sort_rank,
  title,planned_minutes,proof_mode,created_by)
  values(p_company,p_worker,p_client_site,p_shift,p_day,p_rank,btrim(p_title),p_minutes,p_proof_mode,auth.uid())
  returning * into m;
 else
  select * into m from private.essential_missions
  where company_id=p_company and id=p_id for update;
  if not found then raise exception using errcode='42501',message='Mission étrangère ou absente';end if;
  if m.version<>p_expected_version or m.status<>'draft' then
   raise exception using errcode='22023',message='Mission publiée ou modifiée; actualisez le brouillon';end if;
  update private.essential_missions
   set worker_id=p_worker,client_site_id=p_client_site,shift_id=p_shift,
    service_day=p_day,sort_rank=p_rank,title=btrim(p_title),planned_minutes=p_minutes,
    proof_mode=p_proof_mode,version=version+1
  where company_id=p_company and id=m.id returning * into m;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'essential_mission_draft_saved',m.id,
 jsonb_build_object('worker_id',m.worker_id,'site_id',m.client_site_id,'day',m.service_day,'status','draft','version',m.version),
 'Brouillon indépendant du pointage');
 return jsonb_build_object('id',m.id,'version',m.version,'status',m.status);
end $$;

create function public.publish_essential_mission(
 p_company uuid,p_mission uuid,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m private.essential_missions;worker public.company_workers;
begin
 if auth.uid() is null or not private.is_manager(p_company) or
 not private.essential_missions_entitled(p_company) or
 not exists(select 1 from private.essential_mission_settings a where a.company_id=p_company and a.enabled)
 then raise exception using errcode='42501',message='Publication non autorisée';end if;
 select * into m from private.essential_missions
 where company_id=p_company and id=p_mission for update;
 if not found then raise exception using errcode='42501',message='Mission absente';end if;
 if m.version<>p_expected_version or m.status<>'draft' then
  raise exception using errcode='22023',message='Brouillon modifié ou déjà publié';end if;
 select * into worker from public.company_workers where company_id=p_company and id=m.worker_id and status='active';
 if not found or not exists(select 1 from public.essential_client_sites s
   join public.essential_clients c on c.id=s.client_id and c.company_id=s.company_id and c.active
   where s.company_id=p_company and s.id=m.client_site_id and s.active) then
  raise exception using errcode='22023',message='Salarié ou client archivé avant publication';end if;
 update private.essential_missions set status='published',published_at=clock_timestamp(),version=version+1
 where company_id=p_company and id=m.id returning * into m;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'essential_mission_published',m.id,
  jsonb_build_object('worker_id',m.worker_id,'day',m.service_day,'rank',m.sort_rank,'version',m.version),
  'Publication explicite, aucun quart ni punch');
 if worker.auth_user_id is not null and worker.personal_access and exists(
   select 1 from public.company_members member where member.company_id=p_company
   and member.user_id=worker.auth_user_id and member.status='active') then
   insert into public.app_notifications(company_id,recipient_id,kind,title,body)
   values(p_company,worker.auth_user_id,'mission_published','Nouvelle mission publiée',
    'Une mission vous a été attribuée. Consultez vos missions dans PUNCH.');
 end if;
 return jsonb_build_object('id',m.id,'version',m.version,'status',m.status);
end $$;

create function public.list_essential_missions(p_company uuid,p_day date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;manager boolean;on boolean;
begin
 if p_day is null or p_company is null or auth.uid() is null or not private.is_member(p_company) or
 not private.essential_missions_entitled(p_company) then
 raise exception using errcode='42501',message='Missions privées de la compagnie';end if;
 manager:=private.is_manager(p_company);
 select enabled into on from private.essential_mission_settings where company_id=p_company;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_rank,t.id),'[]'::jsonb)
 into result from (
  select m.id,m.worker_id,m.client_site_id,m.shift_id,m.service_day,m.sort_rank,m.title,
   m.planned_minutes,m.proof_mode,m.status,m.version,m.published_at,m.completed_at,
   c.name as client_name,s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,s.timezone
  from private.essential_missions m
  join public.essential_client_sites s on s.company_id=m.company_id and s.id=m.client_site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  left join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and m.service_day=p_day
   and (manager or (w.auth_user_id=auth.uid() and w.status='active' and w.personal_access
     and m.status in ('published','completed')))
  order by m.sort_rank,m.id limit 201
 ) t;
 return jsonb_build_object('items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_rank')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(result) limit 200) bounded
 ),'has_more',jsonb_array_length(result)>200,'enabled',coalesce(on,false));
end $$;

create function public.complete_essential_mission(
 p_company uuid,p_mission uuid,p_expected_version integer,p_request uuid,p_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare m private.essential_missions;z text;nextmission private.essential_missions;
begin
 if auth.uid() is null or p_company is null or p_mission is null or p_request is null or
  p_note is null or char_length(p_note)>500 or not private.is_member(p_company) or
  not private.essential_missions_entitled(p_company) then
 raise exception using errcode='42501',message='Fin de mission non autorisée';end if;
 select * into m from private.essential_missions where company_id=p_company and id=p_mission for update;
 if not found or not exists(select 1 from public.company_workers w
    where w.company_id=p_company and w.id=m.worker_id
      and w.auth_user_id=auth.uid() and w.personal_access and w.status='active') then
 raise exception using errcode='42501',message='Mission personnelle publiée requise';end if;
 if m.status='completed' then
  return jsonb_build_object('id',m.id,'status','completed','duplicate',true,'version',m.version);
 end if;
 if m.status<>'published' or m.version is distinct from p_expected_version then
  raise exception using errcode='22023',message='Mission modifiée ou non publiée';end if;
 select s.timezone into z from public.essential_client_sites s where s.company_id=p_company and s.id=m.client_site_id;
 if m.service_day>(clock_timestamp() at time zone z)::date
 or m.service_day<(clock_timestamp() at time zone z)::date-1 then
  raise exception using errcode='22023',message='Terminer la mission seulement le jour prévu ou le lendemain';end if;
 if m.proof_mode='comment' and char_length(btrim(p_note))<2 then
  raise exception using errcode='22023',message='Commentaire requis pour terminer cette mission';end if;
 if exists(select 1 from private.essential_missions other where other.company_id=p_company
  and other.completion_request=p_request and other.id<>m.id) then
  raise exception using errcode='23505',message='Identifiant de fin utilisé pour une autre mission';end if;
 update private.essential_missions set status='completed',completed_at=clock_timestamp(),
  completed_by=auth.uid(),completion_request=p_request,completion_note=btrim(p_note),version=version+1
 where id=m.id returning * into m;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'essential_mission_completed',m.id,
 jsonb_build_object('worker_id',m.worker_id,'day',m.service_day,'rank',m.sort_rank,'status','completed'),
 'Fin explicite de mission; pas de Punch sortie ni mutation des segments');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select p_company,member.user_id,'mission_completed','Mission terminée',
 'Une mission publiée a été terminée; consultez le suivi dans PUNCH.'
 from public.company_members member
 where member.company_id=p_company and member.status='active' and member.role in ('boss','admin')
 and member.user_id<>auth.uid();
 select * into nextmission from private.essential_missions
 where company_id=p_company and worker_id=m.worker_id and service_day=m.service_day
  and status='published' and sort_rank>m.sort_rank
 order by sort_rank,id limit 1;
 return jsonb_build_object('id',m.id,'status','completed','duplicate',false,'version',m.version,
  'next_mission_id',nextmission.id);
end $$;
revoke all on function public.set_essential_missions_enabled(uuid,boolean) from public,anon;
revoke all on function public.save_essential_mission(uuid,uuid,integer,uuid,uuid,uuid,date,integer,text,integer,text) from public,anon;
revoke all on function public.publish_essential_mission(uuid,uuid,integer) from public,anon;
revoke all on function public.list_essential_missions(uuid,date) from public,anon;
revoke all on function public.complete_essential_mission(uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.set_essential_missions_enabled(uuid,boolean) to authenticated;
grant execute on function public.save_essential_mission(uuid,uuid,integer,uuid,uuid,uuid,date,integer,text,integer,text) to authenticated;
grant execute on function public.publish_essential_mission(uuid,uuid,integer) to authenticated;
grant execute on function public.list_essential_missions(uuid,date) to authenticated;
grant execute on function public.complete_essential_mission(uuid,uuid,integer,uuid,text) to authenticated;
