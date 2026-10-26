-- SHIFT-019: preferences are voluntary; manager-entered seniority/contract limits are
-- informational until local employment rules are independently validated.
-- Do not infer wage, overtime entitlements, certifications or labour law from preferences.
create table public.essential_worker_schedule_preferences (
 company_id uuid not null,
 worker_id uuid not null,
 desired_weekly_hours numeric(5,2),
 preferred_periods text[] not null default '{}',
 weekend_preference text not null default 'flexible',
 overtime_volunteer boolean not null default false,
 last_minute_volunteer boolean not null default false,
 desired_extra_weekly_hours numeric(5,2),
 seniority_from date,
 contracted_min_weekly_hours numeric(5,2),
 contracted_max_weekly_hours numeric(5,2),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null,
 last_request uuid,
 primary key(company_id,worker_id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 check(desired_weekly_hours is null or desired_weekly_hours between 0 and 80),
 check(desired_extra_weekly_hours is null or desired_extra_weekly_hours between 0 and 40),
 check(contracted_min_weekly_hours is null or contracted_min_weekly_hours between 0 and 80),
 check(contracted_max_weekly_hours is null or contracted_max_weekly_hours between 0 and 80),
 check(contracted_min_weekly_hours is null or contracted_max_weekly_hours is null or contracted_min_weekly_hours<=contracted_max_weekly_hours),
 check(weekend_preference in ('flexible','prefer','avoid'))
);
alter table public.essential_worker_schedule_preferences enable row level security;
revoke all on public.essential_worker_schedule_preferences from public,anon,authenticated;

create function public.save_essential_worker_schedule_preferences(
 p_company uuid,p_worker uuid,p_desired numeric,p_periods text[],p_weekend text,
 p_volunteer boolean,p_last_minute boolean,p_extra numeric,p_version integer,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workers;pref public.essential_worker_schedule_preferences;v_present boolean;
begin
 if auth.uid() is null or p_company is null or p_worker is null or p_request is null
   or p_version is null or p_version<0 or p_periods is null or
   cardinality(p_periods)>3 or
   (select count(distinct x) from unnest(p_periods) x where x in ('day','evening','night'))<>cardinality(p_periods)
   or p_weekend is null or p_weekend not in ('flexible','prefer','avoid')
   or p_volunteer is null or p_last_minute is null
   or (not p_volunteer and (p_last_minute or p_extra is not null))
   or (p_desired is not null and (p_desired<0 or p_desired>80))
   or (p_extra is not null and (p_extra<0 or p_extra>40)) then
  raise exception using errcode='22023',message='Préférences horaires invalides';
 end if;
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Préférences non autorisées';
 end if;
 select * into w from public.company_workers where company_id=p_company and id=p_worker and status='active';
 if not found or (not private.is_manager(p_company) and (w.auth_user_id is distinct from auth.uid() or not w.personal_access)) then
  raise exception using errcode='42501',message='Dossier salarié non autorisé';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staffpref:'||p_company::text||':'||p_worker::text,0));
 select * into pref from public.essential_worker_schedule_preferences
  where company_id=p_company and worker_id=p_worker for update;
 v_present:=found;
 if v_present and pref.last_request=p_request then
  return jsonb_build_object('worker_id',p_worker,'version',pref.version,'duplicate',true);
 end if;
 if coalesce(pref.version,0)<>p_version then
  raise exception using errcode='22023',message='Les préférences ont changé. Actualisez avant de réessayer.';
 end if;
 if v_present then
  update public.essential_worker_schedule_preferences set desired_weekly_hours=p_desired,
   preferred_periods=p_periods,weekend_preference=p_weekend,overtime_volunteer=p_volunteer,
   last_minute_volunteer=p_last_minute,desired_extra_weekly_hours=p_extra,
   updated_at=clock_timestamp(),updated_by=auth.uid(),last_request=p_request,version=version+1
  where company_id=p_company and worker_id=p_worker returning * into pref;
 else
  insert into public.essential_worker_schedule_preferences(company_id,worker_id,desired_weekly_hours,
   preferred_periods,weekend_preference,overtime_volunteer,last_minute_volunteer,
   desired_extra_weekly_hours,updated_by,last_request)
  values(p_company,p_worker,p_desired,p_periods,p_weekend,p_volunteer,p_last_minute,p_extra,auth.uid(),p_request)
  returning * into pref;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'worker_schedule_preferences_saved',p_worker,
  jsonb_build_object('version',pref.version,'volunteer',p_volunteer),'Souhait déclaré; aucune attribution ni heure acquise');
 return jsonb_build_object('worker_id',p_worker,'version',pref.version,'duplicate',false);
end $$;

-- Separate manager-only correction for declared contract limits/seniority.
create function public.set_essential_worker_schedule_constraints(
 p_company uuid,p_worker uuid,p_seniority date,p_min numeric,p_max numeric,p_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare pref public.essential_worker_schedule_preferences;
begin
 if not private.is_manager(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Responsable de la compagnie requis';
 end if;
 if p_worker is null or p_version is null or p_version<0
  or (p_min is not null and (p_min<0 or p_min>80))
  or (p_max is not null and (p_max<0 or p_max>80))
  or (p_min is not null and p_max is not null and p_min>p_max)
  or (p_seniority is not null and p_seniority>current_date) then
  raise exception using errcode='22023',message='Contraintes déclarées invalides';
 end if;
 if not exists(select 1 from public.company_workers where company_id=p_company and id=p_worker and status='active') then
  raise exception using errcode='42501',message='Salarié actif de la compagnie requis';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staffpref:'||p_company::text||':'||p_worker::text,0));
 select * into pref from public.essential_worker_schedule_preferences
 where company_id=p_company and worker_id=p_worker for update;
 if coalesce(pref.version,0)<>p_version then
  raise exception using errcode='22023',message='Fiche modifiée. Actualisez-la.';
 end if;
 if found then
  update public.essential_worker_schedule_preferences
  set seniority_from=p_seniority,contracted_min_weekly_hours=p_min,contracted_max_weekly_hours=p_max,
      updated_at=clock_timestamp(),updated_by=auth.uid(),version=version+1
  where company_id=p_company and worker_id=p_worker returning * into pref;
 else
  insert into public.essential_worker_schedule_preferences
    (company_id,worker_id,seniority_from,contracted_min_weekly_hours,contracted_max_weekly_hours,updated_by)
  values(p_company,p_worker,p_seniority,p_min,p_max,auth.uid()) returning * into pref;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'worker_schedule_constraints_saved',p_worker,
  jsonb_build_object('version',pref.version),'Données déclarées par un responsable, sans règle légale inférée');
 return jsonb_build_object('worker_id',p_worker,'version',pref.version);
end $$;

-- The employee sees only their own record; managers see active staff in this company.
-- Professional certifications are read from the pre-existing HR register, never rewritten here.
create function public.list_essential_worker_schedule_preferences(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Accès aux préférences refusé';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.employee_number),'[]'::jsonb) into v_result
 from (
  select w.id as worker_id,w.employee_number,w.first_name,w.last_name,
   p.version,p.desired_weekly_hours,p.preferred_periods,p.weekend_preference,
   p.overtime_volunteer,p.last_minute_volunteer,p.desired_extra_weekly_hours,
   p.seniority_from,p.contracted_min_weekly_hours,p.contracted_max_weekly_hours,p.updated_at,
   coalesce((select jsonb_agg(jsonb_build_object('title',c.title,'expires_on',c.expires_on) order by c.title)
      from public.essential_certifications c where c.company_id=p_company and c.worker_id=w.id),'[]'::jsonb) as certifications
  from public.company_workers w
  left join public.essential_worker_schedule_preferences p on p.company_id=w.company_id and p.worker_id=w.id
  where w.company_id=p_company and w.status='active'
   and (private.is_manager(p_company) or (w.auth_user_id=auth.uid() and w.personal_access))
  order by w.employee_number limit 500
 ) x;
 return v_result;
end $$;

revoke all on function public.save_essential_worker_schedule_preferences(uuid,uuid,numeric,text[],text,boolean,boolean,numeric,integer,uuid) from public,anon;
revoke all on function public.set_essential_worker_schedule_constraints(uuid,uuid,date,numeric,numeric,integer) from public,anon;
revoke all on function public.list_essential_worker_schedule_preferences(uuid) from public,anon;
grant execute on function public.save_essential_worker_schedule_preferences(uuid,uuid,numeric,text[],text,boolean,boolean,numeric,integer,uuid) to authenticated;
grant execute on function public.set_essential_worker_schedule_constraints(uuid,uuid,date,numeric,numeric,integer) to authenticated;
grant execute on function public.list_essential_worker_schedule_preferences(uuid) to authenticated;
