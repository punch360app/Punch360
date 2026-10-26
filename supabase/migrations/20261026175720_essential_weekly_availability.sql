-- Recurring availability is a rule, NOT a published shift or a payroll decision.
-- Dated availability (essential_availability) stays the exception source of truth.
create table public.essential_weekly_availability (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 worker_id uuid not null,
 location_id uuid not null,
 days integer[] not null check (cardinality(days) between 1 and 7),
 starts_local time without time zone not null,
 ends_local time without time zone not null,
 effective_from date not null,
 effective_until date,
 available boolean not null,
 version integer not null default 1 check(version>0),
 active boolean not null default true,
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 request_id uuid not null,
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 foreign key(company_id,location_id) references public.essential_locations(company_id,id),
 unique(company_id,worker_id,request_id),
 check (ends_local>starts_local),
 check (effective_until is null or effective_until>=effective_from)
);
create index essential_weekly_availability_worker on public.essential_weekly_availability(company_id,worker_id,location_id) where active;
alter table public.essential_weekly_availability enable row level security;
revoke all on public.essential_weekly_availability from public,anon,authenticated;

create function public.save_essential_weekly_availability(
 p_company uuid,p_worker uuid,p_location uuid,p_days integer[],
 p_start time without time zone,p_end time without time zone,
 p_from date,p_until date,p_available boolean,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workers;loc public.essential_locations;v public.essential_weekly_availability;
 v_conflicts integer:=0;v_unique_count integer;
begin
 if auth.uid() is null or p_company is null or p_worker is null or p_location is null or p_request is null or
    p_days is null or cardinality(p_days) not between 1 and 7 or
    p_start is null or p_end is null or p_start>=p_end or
    p_from is null or p_from<current_date-interval '1 year' or p_from>current_date+interval '2 years' or
    (p_until is not null and (p_until<p_from or p_until>p_from+interval '3 years')) or
    p_available is null then
  raise exception using errcode='22023',message='Règle hebdomadaire invalide. Les plages traversant minuit doivent être séparées.';
 end if;
 select count(distinct day) into v_unique_count from unnest(p_days) day where day between 1 and 7;
 if v_unique_count<>cardinality(p_days) then raise exception using errcode='22023',message='Jours ISO 1 à 7 uniques requis';end if;
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Disponibilités non autorisées';
 end if;
 select * into w from public.company_workers where company_id=p_company and id=p_worker and status='active';
 if not found or (not private.is_manager(p_company) and
    (w.auth_user_id is distinct from auth.uid() or not w.personal_access)) then
  raise exception using errcode='42501',message='Dossier salarié non autorisé';
 end if;
 select * into loc from public.essential_locations where company_id=p_company and id=p_location and active;
 if not found then raise exception using errcode='42501',message='Établissement non autorisé';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('weekly:'||p_company::text||':'||w.id::text,0));
 select * into v from public.essential_weekly_availability
 where company_id=p_company and worker_id=w.id and request_id=p_request;
 if found then return jsonb_build_object('id',v.id,'version',v.version,'duplicate',true,'conflicts',0);end if;
 if exists(select 1 from public.essential_weekly_availability other
  where other.company_id=p_company and other.worker_id=w.id and other.location_id=p_location and other.active
    and other.days && p_days and other.starts_local<p_end and other.ends_local>p_start
    and other.effective_from<=coalesce(p_until,'infinity'::date)
    and coalesce(other.effective_until,'infinity'::date)>=p_from) then
  raise exception using errcode='23505',message='Plages hebdomadaires superposées pour ce salarié et cet établissement';
 end if;
 insert into public.essential_weekly_availability
 (company_id,worker_id,location_id,days,starts_local,ends_local,effective_from,effective_until,available,created_by,updated_by,request_id)
 values(p_company,w.id,p_location,p_days,p_start,p_end,p_from,p_until,p_available,auth.uid(),auth.uid(),p_request) returning * into v;
 if not p_available then
  select count(*) into v_conflicts from public.scheduled_shifts sh
  where sh.company_id=p_company and sh.worker_id=w.id and sh.location_id=p_location
   and sh.cancelled_at is null and sh.ends_at>clock_timestamp() and sh.starts_at<clock_timestamp()+interval '90 days'
   and (sh.starts_at at time zone loc.timezone)::date between p_from and coalesce(p_until,'infinity'::date)
   and extract(isodow from (sh.starts_at at time zone loc.timezone))::int=any(p_days)
   and (sh.starts_at at time zone loc.timezone)::time<p_end
   and (sh.ends_at at time zone loc.timezone)::time>p_start;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'weekly_availability_saved',v.id,
        jsonb_build_object('worker_id',w.id,'location_id',p_location,'version',v.version,'conflicts',v_conflicts),
        'Disponibilité hebdomadaire, quarts publiés conservés');
 return jsonb_build_object('id',v.id,'version',v.version,'duplicate',false,'conflicts',v_conflicts);
end $$;

create function public.remove_essential_weekly_availability(p_id uuid,p_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.essential_weekly_availability;w public.company_workers;
begin
 select * into v from public.essential_weekly_availability where id=p_id for update;
 if not found or not private.is_member(v.company_id) or not private.essential_feature(v.company_id,'availability') then
  raise exception using errcode='42501',message='Règle non autorisée';
 end if;
 select * into w from public.company_workers where company_id=v.company_id and id=v.worker_id and status='active';
 if not found or (not private.is_manager(v.company_id) and
 (w.auth_user_id is distinct from auth.uid() or not w.personal_access)) then
  raise exception using errcode='42501',message='Règle personnelle requise';
 end if;
 if not v.active or v.version<>p_version then raise exception using errcode='22023',message='Règle modifiée. Actualisez la page.';end if;
 update public.essential_weekly_availability set active=false,version=version+1,
 updated_by=auth.uid(),updated_at=clock_timestamp() where id=v.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason)
 values(v.company_id,auth.uid(),'weekly_availability_archived',v.id,
 jsonb_build_object('version',v.version,'worker_id',v.worker_id),'Règle désactivée, aucun quart modifié');
 return true;
end $$;

create function public.list_essential_weekly_availability(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Accès aux disponibilités refusé';
 end if;
 select coalesce(jsonb_agg(to_jsonb(rule) order by rule.effective_from,rule.starts_local),'[]'::jsonb)
 into v_result from (
  select a.id,a.worker_id,a.location_id,a.days,a.starts_local,a.ends_local,
   a.effective_from,a.effective_until,a.available,a.version,a.created_by,a.updated_at
  from public.essential_weekly_availability a
  where a.company_id=p_company and a.active
   and (private.is_manager(p_company) or exists (
    select 1 from public.company_workers w where w.id=a.worker_id and w.company_id=p_company
     and w.status='active' and w.personal_access and w.auth_user_id=auth.uid()
   ))
  order by a.effective_from,a.starts_local limit 500
 ) rule;
 return v_result;
end $$;

-- A bounded, *read-only* preview for real published shifts. Unknown is explicit.
-- Precedence: reported absence / approved leave -> dated exception -> weekly rule -> unknown.
-- Never fabricate overnight or partially covered availability.
create function public.essential_availability_shift_preview(p_company uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sh record;v_status text;v_source text;v_start timestamp;v_end timestamp;
 v_result jsonb:='[]'::jsonb;v_manager boolean;
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Prévisualisation non autorisée';
 end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to>p_from+interval '32 days' then
  raise exception using errcode='22023',message='Période maximale de 32 jours';
 end if;
 v_manager:=private.is_manager(p_company);
 for sh in
  select s.id,s.company_id,s.worker_id,s.starts_at,s.ends_at,s.timezone,s.location_id,w.auth_user_id
  from public.scheduled_shifts s join public.company_workers w
   on w.company_id=s.company_id and w.id=s.worker_id and w.status='active'
  where s.company_id=p_company and s.cancelled_at is null
   and s.starts_at<p_to and s.ends_at>p_from
   and (v_manager or (w.auth_user_id=auth.uid() and w.personal_access))
  order by s.starts_at,s.id limit 201
 loop
  if jsonb_array_length(v_result)>=200 then exit;end if;
  v_status:='unknown';v_source:='no_rule';
  v_start:=sh.starts_at at time zone sh.timezone;
  v_end:=sh.ends_at at time zone sh.timezone;
  if exists(select 1 from private.essential_shift_absences a
    where a.company_id=p_company and a.shift_id=sh.id)
  then v_status:='unavailable';v_source:='absence';
  elsif exists(select 1 from public.leave_requests lv where lv.company_id=p_company
    and lv.user_id=sh.auth_user_id and lv.status='approved'
    and lv.begins_on<=v_end::date and lv.ends_on>=v_start::date)
  then v_status:='unavailable';v_source:='approved_leave';
  elsif exists(select 1 from public.essential_availability x
    where x.company_id=p_company and x.worker_id=sh.worker_id
    and x.starts_at<sh.ends_at and x.ends_at>sh.starts_at)
  then
   if exists(select 1 from public.essential_availability x
    where x.company_id=p_company and x.worker_id=sh.worker_id and not x.available
      and x.starts_at<sh.ends_at and x.ends_at>sh.starts_at)
   then v_status:='unavailable';
   elsif exists(select 1 from public.essential_availability x
     where x.company_id=p_company and x.worker_id=sh.worker_id and x.available
      and x.starts_at<=sh.starts_at and x.ends_at>=sh.ends_at)
   then v_status:='available';
   end if;
   v_source:='dated_exception';
  elsif v_start::date=v_end::date then
   if exists(select 1 from public.essential_weekly_availability a
    where a.company_id=p_company and a.worker_id=sh.worker_id
      and a.location_id=sh.location_id and a.active and not a.available
      and extract(isodow from v_start)::integer=any(a.days)
      and a.effective_from<=v_start::date and (a.effective_until is null or a.effective_until>=v_start::date)
      and a.starts_local<v_end::time and a.ends_local>v_start::time)
   then v_status:='unavailable';v_source:='weekly';
   elsif exists(select 1 from public.essential_weekly_availability a
    where a.company_id=p_company and a.worker_id=sh.worker_id
      and a.location_id=sh.location_id and a.active and a.available
      and extract(isodow from v_start)::integer=any(a.days)
      and a.effective_from<=v_start::date and (a.effective_until is null or a.effective_until>=v_start::date)
      and a.starts_local<=v_start::time and a.ends_local>=v_end::time)
   then v_status:='available';v_source:='weekly';
   end if;
  else
   v_source:='overnight_unknown';
  end if;
  v_result:=v_result||jsonb_build_array(jsonb_build_object(
    'shift_id',sh.id,'worker_id',sh.worker_id,'starts_at',sh.starts_at,
    'status',v_status,'source',v_source,'conflict',v_status='unavailable'));
 end loop;
 return jsonb_build_object('shifts',v_result,'max_results',200);
end $$;

revoke all on function public.save_essential_weekly_availability(uuid,uuid,uuid,integer[],time without time zone,time without time zone,date,date,boolean,uuid) from public,anon;
revoke all on function public.remove_essential_weekly_availability(uuid,integer) from public,anon;
revoke all on function public.list_essential_weekly_availability(uuid) from public,anon;
revoke all on function public.essential_availability_shift_preview(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.save_essential_weekly_availability(uuid,uuid,uuid,integer[],time without time zone,time without time zone,date,date,boolean,uuid) to authenticated;
grant execute on function public.remove_essential_weekly_availability(uuid,integer) to authenticated;
grant execute on function public.list_essential_weekly_availability(uuid) to authenticated;
grant execute on function public.essential_availability_shift_preview(uuid,timestamptz,timestamptz) to authenticated;
