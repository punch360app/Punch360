-- MISSION-001/002/003/004/005/006/013/014, initial manual published route.
-- One published mission is NEVER an extra shift, punch, pay record, mileage entry or invoice.
create table private.essential_mission_settings(
 company_id uuid primary key references public.companies(id),
 enabled boolean not null default false,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp()
);
alter table private.essential_mission_settings enable row level security;
revoke all on private.essential_mission_settings from public,anon,authenticated;

create table private.essential_missions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 worker_id uuid not null,
 site_id uuid not null,
 mission_day date not null,
 sort_order integer not null check(sort_order between 1 and 999),
 title text not null check(length(btrim(title)) between 2 and 140),
 instructions text not null default '' check(length(instructions)<=500),
 status text not null default 'draft' check(status in ('draft','published','completed','cancelled')),
 version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 completed_by uuid references auth.users(id),
 completed_at timestamptz,
 unique(company_id,id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 foreign key(company_id,site_id) references public.essential_client_sites(company_id,id),
 check((status='completed')=(completed_at is not null))
);
create index essential_missions_employee_day on private.essential_missions(company_id,worker_id,mission_day,sort_order)
 where status <> 'cancelled';
alter table private.essential_missions enable row level security;
revoke all on private.essential_missions from public,anon,authenticated;

create table private.essential_mission_completions(
 company_id uuid not null,
 mission_id uuid not null,
 request_id uuid not null,
 completed_by uuid not null references auth.users(id),
 result_version integer not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,mission_id,request_id),
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
alter table private.essential_mission_completions enable row level security;
revoke all on private.essential_mission_completions from public,anon,authenticated;

create function private.essential_mission_manager(p_company uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select private.is_manager(p_company) and exists(
  select 1 from public.companies c where c.id=p_company and c.product_edition='essential'
 )
$$;
revoke all on function private.essential_mission_manager(uuid) from public,anon,authenticated;

create function public.essential_missions_configuration(p_company uuid,p_enabled boolean default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare v_enabled boolean;
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
 select enabled into v_enabled from private.essential_mission_settings where company_id=p_company;
 return jsonb_build_object('enabled',coalesce(v_enabled,false),'manual_only',true);
end $$;

create function public.save_essential_mission(
 p_company uuid,p_id uuid,p_version integer,p_worker uuid,p_site uuid,p_day date,
 p_order integer,p_title text,p_instructions text,p_publish boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_original private.essential_missions;
 v_created boolean:=false;v_should_notify boolean:=false;v_recipient uuid;v_status text;
begin
 if not private.essential_mission_manager(p_company) or
  not exists(select 1 from private.essential_mission_settings c where c.company_id=p_company and c.enabled)
 then raise exception using errcode='42501',message='Activez le module et vérifiez vos droits de responsable';end if;
 if p_version is null or p_version<0 or p_day is null or
  p_day<current_date-7 or p_day>current_date+180 or
  p_order not between 1 and 999 or length(btrim(coalesce(p_title,''))) not between 2 and 140 or
  length(coalesce(p_instructions,''))>500 or p_publish is null then
  raise exception using errcode='22023',message='Mission, jour ou ordre invalide';
 end if;
 if not exists(select 1 from public.company_workers w where w.company_id=p_company and w.id=p_worker and w.status='active')
  or not exists(select 1 from public.essential_client_sites s
    join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
    where s.company_id=p_company and s.id=p_site and s.active and c.active) then
  raise exception using errcode='42501',message='Salarié ou adresse client absent de cette compagnie';
 end if;
 v_status:=case when p_publish then 'published' else 'draft' end;
 if p_id is null then
  if p_version<>0 then raise exception using errcode='22023',message='Une nouvelle mission exige la version zéro';end if;
  insert into private.essential_missions(company_id,worker_id,site_id,mission_day,sort_order,title,instructions,
   status,created_by,updated_by)
  values(p_company,p_worker,p_site,p_day,p_order,btrim(p_title),btrim(coalesce(p_instructions,'')),
   v_status,auth.uid(),auth.uid()) returning * into v;
  v_created:=true;v_should_notify:=p_publish;
 else
  select * into v_original from private.essential_missions where id=p_id and company_id=p_company for update;
  if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
  if v_original.version<>p_version then raise exception using errcode='22023',message='Mission modifiée par un autre responsable. Rechargez.';end if;
  if v_original.status not in ('draft','published') then
   raise exception using errcode='22023',message='Mission achevée ou annulée : nouvelle mission requise';end if;
  v_should_notify:=p_publish and
   (v_original.status<>'published' or v_original.worker_id<>p_worker or v_original.site_id<>p_site or
    v_original.mission_day<>p_day or v_original.sort_order<>p_order or v_original.title<>btrim(p_title));
  update private.essential_missions set worker_id=p_worker,site_id=p_site,mission_day=p_day,
   sort_order=p_order,title=btrim(p_title),instructions=btrim(coalesce(p_instructions,'')),status=v_status,
   version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
  where id=p_id and company_id=p_company returning * into v;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),case when v_created then 'mission_created' else 'mission_updated' end,v.id,
  case when v_created then null else jsonb_build_object('version',v_original.version,'status',v_original.status,
   'worker_id',v_original.worker_id,'site_id',v_original.site_id) end,
  jsonb_build_object('version',v.version,'status',v.status,'worker_id',v.worker_id,'site_id',v.site_id,
   'mission_day',v.mission_day,'sort_order',v.sort_order),
  'Mission distincte des horaires, pointages et déplacements');
 if v_should_notify then
  select w.auth_user_id into v_recipient from public.company_workers w join public.company_members m
   on m.company_id=w.company_id and m.user_id=w.auth_user_id and m.status='active'
  where w.company_id=p_company and w.id=p_worker and w.status='active' and w.personal_access;
  if v_recipient is not null then
   insert into public.app_notifications(company_id,recipient_id,kind,title,body)
    values(p_company,v_recipient,'mission_published','Intervention attribuée',
    'Consultez vos missions du '||to_char(p_day,'YYYY-MM-DD')||' pour les détails.');
  end if;
 end if;
 return jsonb_build_object('id',v.id,'version',v.version,'status',v.status,'created',v_created,
  'notification_sent',v_should_notify and v_recipient is not null);
end $$;

create function public.list_essential_missions(
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
   m.completed_at,s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and m.mission_day=p_day and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','completed'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $$;

create function public.complete_essential_mission(
 p_company uuid,p_id uuid,p_version integer,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_missions;v_prev integer;v_worker uuid;
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
 if v.status<>'published' or v.version<>p_version then
  raise exception using errcode='22023',message='Mission modifiée ou déjà terminée. Actualisez la liste.';end if;
 update private.essential_missions set status='completed',version=version+1,completed_by=auth.uid(),
  completed_at=clock_timestamp(),updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 insert into private.essential_mission_completions(company_id,mission_id,request_id,completed_by,result_version)
 values(p_company,p_id,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_completed',v.id,
  jsonb_build_object('version',p_version,'status','published'),
  jsonb_build_object('version',v.version,'status','completed'),
  'Terminer la mission n’affecte ni la session de pointage ni les heures');
 return jsonb_build_object('id',v.id,'version',v.version,'status','completed','duplicate',false);
end $$;

revoke all on function public.essential_missions_configuration(uuid,boolean) from public,anon;
revoke all on function public.save_essential_mission(uuid,uuid,integer,uuid,uuid,date,integer,text,text,boolean) from public,anon;
revoke all on function public.list_essential_missions(uuid,date,uuid,boolean) from public,anon;
revoke all on function public.complete_essential_mission(uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.essential_missions_configuration(uuid,boolean) to authenticated;
grant execute on function public.save_essential_mission(uuid,uuid,integer,uuid,uuid,date,integer,text,text,boolean) to authenticated;
grant execute on function public.list_essential_missions(uuid,date,uuid,boolean) to authenticated;
grant execute on function public.complete_essential_mission(uuid,uuid,integer,uuid) to authenticated;
