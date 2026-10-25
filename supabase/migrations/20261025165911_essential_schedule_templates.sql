-- Reusable planning presets; they never contain worker identities or publish shifts.
create table public.essential_schedule_templates(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 location_id uuid not null,department_id uuid,name text not null check(length(trim(name)) between 2 and 100),
 configuration jsonb not null,version integer not null default 1,active boolean not null default true,
 updated_at timestamptz not null default now(),unique(company_id,id),
 foreign key(company_id,location_id) references public.essential_locations(company_id,id),
 foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
create index schedule_templates_scope on public.essential_schedule_templates(company_id,department_id,active);
alter table public.essential_schedule_templates enable row level security;
create policy schedule_templates_read on public.essential_schedule_templates for select to authenticated using(private.essential_can_plan(company_id,department_id));
grant select on public.essential_schedule_templates to authenticated;
revoke insert,update,delete on public.essential_schedule_templates from anon,authenticated;
create function public.save_essential_schedule_template(p_company uuid,p_location uuid,p_department uuid,p_name text,p_configuration jsonb,p_template uuid default null,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.essential_schedule_templates;v_id uuid;mode text;d integer;week integer;k text;v jsonb;
begin
 if not private.essential_can_plan(p_company,p_department) or not private.essential_feature(p_company,'advanced_schedules') then raise exception using errcode='42501',message='Planification avancée requise';end if;
 if not exists(select 1 from public.essential_locations where company_id=p_company and id=p_location and active) or (p_department is not null and not exists(select 1 from public.essential_departments where company_id=p_company and id=p_department and location_id=p_location and active)) then raise exception 'Périmètre invalide';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 100 or p_configuration is null or jsonb_typeof(p_configuration)<>'object' then raise exception 'Nom et configuration requis';end if;
 mode:=p_configuration->>'mode';
 if mode is null or mode not in('weekly','rotate2','rotate3') or exists(select 1 from jsonb_object_keys(p_configuration) key where key not in('mode','days','startTime','endTime','startTime2','endTime2','startTime3','endTime3','note')) then raise exception 'Configuration du modèle invalide';end if;
 if jsonb_typeof(p_configuration->'days') is distinct from 'array' or jsonb_array_length(p_configuration->'days') not between 1 and 7 then raise exception 'Jours requis';end if;
 for v in select value from jsonb_array_elements(p_configuration->'days') loop
  if jsonb_typeof(v)<>'number' or v::text !~ '^[1-7]$' then raise exception 'Jours ISO 1 à 7 requis';end if;
 end loop;
 if (select count(distinct value) from jsonb_array_elements(p_configuration->'days'))<>jsonb_array_length(p_configuration->'days') then raise exception 'Jours répétés interdits';end if;
 for week in 1..case mode when 'weekly' then 1 when 'rotate2' then 2 else 3 end loop
  k:=case when week=1 then '' else week::text end;
  if coalesce(p_configuration->>('startTime'||k),'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_configuration->>('endTime'||k),'') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_configuration->>('startTime'||k)=p_configuration->>('endTime'||k) then raise exception 'Heures de cycle invalides';end if;
 end loop;
 if length(coalesce(p_configuration->>'note',''))>1000 then raise exception 'Note trop longue';end if;
 perform pg_advisory_xact_lock(hashtextextended('templates:'||p_company::text,0));
 if p_template is not null then
  select * into t from public.essential_schedule_templates where company_id=p_company and id=p_template for update;
  if not found or not private.essential_can_plan(t.company_id,t.department_id) or t.version is distinct from p_expected_version or not t.active then raise exception 'Modèle modifié ou inaccessible : actualiser';end if;
  update public.essential_schedule_templates set location_id=p_location,department_id=p_department,name=trim(p_name),configuration=p_configuration,version=version+1,updated_at=clock_timestamp() where id=t.id;v_id:=t.id;
 else
  if (select count(*) from public.essential_schedule_templates where company_id=p_company and active)>=200 then raise exception 'Maximum 200 modèles actifs';end if;
  insert into public.essential_schedule_templates(company_id,location_id,department_id,name,configuration) values(p_company,p_location,p_department,trim(p_name),p_configuration) returning id into v_id;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(p_company,auth.uid(),'schedule_template_saved',v_id,to_jsonb(t),jsonb_build_object('name',p_name,'configuration',p_configuration),'Modèle uniquement : aucun quart publié');return v_id;
end $$;
create function public.archive_essential_schedule_template(p_template uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare t public.essential_schedule_templates;
begin
 select * into t from public.essential_schedule_templates where id=p_template for update;
 if not found or not private.essential_can_plan(t.company_id,t.department_id) or not private.essential_feature(t.company_id,'advanced_schedules') then raise exception using errcode='42501',message='Planification avancée requise';end if;
 if t.version is distinct from p_expected_version then raise exception 'Modèle modifié : actualiser';end if;
 update public.essential_schedule_templates set active=false,version=version+1,updated_at=clock_timestamp() where id=t.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason) values(t.company_id,auth.uid(),'schedule_template_archived',t.id,to_jsonb(t),'Aucun quart existant modifié');
end $$;
revoke all on function public.save_essential_schedule_template(uuid,uuid,uuid,text,jsonb,uuid,integer),public.archive_essential_schedule_template(uuid,integer) from public,anon;
grant execute on function public.save_essential_schedule_template(uuid,uuid,uuid,text,jsonb,uuid,integer),public.archive_essential_schedule_template(uuid,integer) to authenticated;
