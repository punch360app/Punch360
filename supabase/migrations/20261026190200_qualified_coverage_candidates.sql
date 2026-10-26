-- Qualified coverage candidates are a read-only preview, not an offer or assignment.
-- All availability/absence/leave details remain private; managers see only a coarse status.
create function public.qualified_coverage_candidates(
 p_rule uuid,p_start timestamptz,p_end timestamptz
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rule public.essential_qualified_coverage;v_zone text;v_location uuid;
 v_worker record;v_status text;v_source text;v_result jsonb:='[]'::jsonb;
 v_available integer:=0;v_unknown integer:=0;v_unavailable integer:=0;
 v_start timestamp;v_end timestamp;
begin
 select * into v_rule from public.essential_qualified_coverage where id=p_rule and active;
 if not found or not private.can_administer(v_rule.company_id) or
   not private.essential_feature(v_rule.company_id,'minimum_coverage') or
   not private.essential_hr_allowed(v_rule.company_id,'certifications') then
  raise exception using errcode='42501',message='Accès aux candidats de couverture refusé';
 end if;
 select l.timezone,l.id into v_zone,v_location
 from public.essential_departments d join public.essential_locations l
   on l.company_id=d.company_id and l.id=d.location_id and l.active
 where d.company_id=v_rule.company_id and d.id=v_rule.department_id and d.active;
 if not found then raise exception using errcode='22023',message='Département indisponible';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '12 hours' or
    p_start<v_rule.starts_at or p_end>v_rule.ends_at then
  raise exception using errcode='22023',message='Choisir une portion de plage maximale de 12 h';
 end if;
 v_start:=p_start at time zone v_zone;
 v_end:=p_end at time zone v_zone;
 if (select count(*) from public.company_workers w where w.company_id=v_rule.company_id and w.status='active'
     and w.department_id=v_rule.department_id and w.location_id=v_location)>250 then
  raise exception using errcode='22023',message='Trop de salariés : filtrer le département';
 end if;
 for v_worker in
  select w.id,w.auth_user_id,w.first_name,w.last_name from public.company_workers w
  where w.company_id=v_rule.company_id and w.status='active'
   and w.department_id=v_rule.department_id and w.location_id=v_location
   and exists(select 1 from public.essential_certifications cert
      where cert.company_id=w.company_id and cert.worker_id=w.id
       and lower(btrim(cert.title))=lower(btrim(v_rule.certificate_title))
       and cert.issued_on<=v_start::date
       and (cert.expires_on is null or cert.expires_on>=v_end::date))
  order by lower(w.first_name),lower(w.last_name),w.id
 loop
  v_status:='unknown';v_source:='not_declared';
  if exists(select 1 from public.leave_requests lv where lv.company_id=v_rule.company_id
      and lv.user_id=v_worker.auth_user_id and lv.status='approved'
      and lv.begins_on<=v_end::date and lv.ends_on>=v_start::date) then
   v_status:='unavailable';v_source:='approved_leave';
  elsif exists(select 1 from private.essential_shift_absences ab
    join public.scheduled_shifts sh on sh.id=ab.shift_id and sh.company_id=ab.company_id
    where ab.company_id=v_rule.company_id and ab.worker_id=v_worker.id
      and sh.starts_at<p_end and sh.ends_at>p_start) then
   v_status:='unavailable';v_source:='reported_absence';
  elsif exists(select 1 from public.scheduled_shifts sh where sh.company_id=v_rule.company_id
      and sh.worker_id=v_worker.id and sh.cancelled_at is null
      and sh.starts_at<p_end and sh.ends_at>p_start) then
   v_status:='unavailable';v_source:='already_scheduled';
  elsif exists(select 1 from public.essential_availability a
    where a.company_id=v_rule.company_id and a.worker_id=v_worker.id
    and a.starts_at<p_end and a.ends_at>p_start) then
    v_source:='dated_exception';
    if exists(select 1 from public.essential_availability a
     where a.company_id=v_rule.company_id and a.worker_id=v_worker.id and not a.available
       and a.starts_at<p_end and a.ends_at>p_start) then v_status:='unavailable';
    elsif exists(select 1 from public.essential_availability a
     where a.company_id=v_rule.company_id and a.worker_id=v_worker.id and a.available
      and a.starts_at<=p_start and a.ends_at>=p_end) then v_status:='available';end if;
  elsif v_start::date=v_end::date then
   if exists(select 1 from public.essential_weekly_availability a
    where a.company_id=v_rule.company_id and a.worker_id=v_worker.id and a.location_id=v_location and a.active
      and extract(isodow from v_start)::integer=any(a.days)
      and a.effective_from<=v_start::date and (a.effective_until is null or a.effective_until>=v_start::date)
      and not a.available and a.starts_local<v_end::time and a.ends_local>v_start::time) then
    v_status:='unavailable';v_source:='weekly';
   elsif exists(select 1 from public.essential_weekly_availability a
    where a.company_id=v_rule.company_id and a.worker_id=v_worker.id and a.location_id=v_location and a.active
      and extract(isodow from v_start)::integer=any(a.days)
      and a.effective_from<=v_start::date and (a.effective_until is null or a.effective_until>=v_start::date)
      and a.available and a.starts_local<=v_start::time and a.ends_local>=v_end::time) then
    v_status:='available';v_source:='weekly';
   end if;
  else
    v_source:='overnight_unknown';
  end if;
  v_available:=v_available+case when v_status='available' then 1 else 0 end;
  v_unavailable:=v_unavailable+case when v_status='unavailable' then 1 else 0 end;
  v_unknown:=v_unknown+case when v_status='unknown' then 1 else 0 end;
  v_result:=v_result||jsonb_build_array(jsonb_build_object(
    'worker_id',v_worker.id,'name',pg_catalog.btrim(v_worker.first_name||' '||v_worker.last_name),
    'status',v_status,'source',v_source));
 end loop;
 return jsonb_build_object('rule_id',v_rule.id,'start',p_start,'end',p_end,
  'certificate_required',v_rule.certificate_title,'available',v_available,
  'unavailable',v_unavailable,'unknown',v_unknown,'candidates',v_result,
  'notice','Aucun quart proposé ni attribué; disponibilités non déclarées = inconnu. Les motifs privés ne sont jamais fournis.');
end $$;
revoke all on function public.qualified_coverage_candidates(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.qualified_coverage_candidates(uuid,timestamptz,timestamptz) to authenticated;
