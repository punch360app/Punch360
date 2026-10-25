-- Immutable requests for a complete, previously absent Essentiel workday.
create table public.essential_missing_days(
 id uuid primary key,company_id uuid not null references public.companies(id),worker_id uuid not null,job_id uuid not null,
 requested_by uuid not null references auth.users(id),starts_at timestamptz not null,ends_at timestamptz not null,
 breaks jsonb not null default '[]',reason text not null check(length(trim(reason)) between 3 and 1000),
 status text not null default 'pending' check(status in('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default clock_timestamp(),reviewed_by uuid references auth.users(id),reviewed_at timestamptz,review_note text,session_id uuid,
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),foreign key(company_id,job_id) references public.jobs(company_id,id),
 foreign key(company_id,session_id) references public.punch_sessions(company_id,id),check(ends_at>starts_at)
);
create index missing_days_company on public.essential_missing_days(company_id,created_at desc);
alter table public.essential_missing_days enable row level security;
create policy missing_days_read on public.essential_missing_days for select to authenticated using(private.is_member(company_id) and (private.is_manager(company_id) or requested_by=auth.uid() or exists(select 1 from public.company_workers w where w.id=worker_id and w.auth_user_id=auth.uid())));
grant select on public.essential_missing_days to authenticated;
revoke insert,update,delete on public.essential_missing_days from public,anon,authenticated;
create function private.validate_missing_day(a timestamptz,b timestamptz,pauses jsonb) returns void language plpgsql set search_path='' as $$
declare x jsonb;y jsonb;s timestamptz;e timestamptz;
begin
 if a is null or b is null or not isfinite(a) or not isfinite(b) or b<=a or b>clock_timestamp() or b-a>interval '26 hours' or jsonb_typeof(pauses) is distinct from 'array' or jsonb_array_length(pauses)>12 then raise exception 'Journée terminée de 26 heures maximum et pauses valides requises';end if;
 for x in select value from jsonb_array_elements(pauses) loop
  s:=(x->>'start')::timestamptz;e:=(x->>'end')::timestamptz;
  if s is null or e is null or not isfinite(s) or not isfinite(e) or s<a or e>b or e<=s or jsonb_typeof(x->'paid') is distinct from 'boolean' then raise exception 'Pause invalide';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(pauses) with ordinality x(v,i),jsonb_array_elements(pauses) with ordinality y(v,i) where x.i<y.i and tstzrange((x.v->>'start')::timestamptz,(x.v->>'end')::timestamptz,'[)')&&tstzrange((y.v->>'start')::timestamptz,(y.v->>'end')::timestamptz,'[)')) then raise exception 'Pauses qui se chevauchent';end if;
end $$;
revoke all on function private.validate_missing_day(timestamptz,timestamptz,jsonb) from public,anon,authenticated;
create function public.request_essential_missing_day(p_request uuid,p_company uuid,p_worker uuid,p_job uuid,p_start timestamptz,p_end timestamptz,p_breaks jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.company_workers;r public.essential_missing_days;
begin
 select * into w from public.company_workers where id=p_worker and company_id=p_company and status='active';
 if not found or not private.is_member(p_company) or (w.auth_user_id is distinct from auth.uid() and not private.can_administer(p_company)) or not exists(select 1 from public.companies where id=p_company and product_edition='essential') then raise exception using errcode='42501',message='Accès refusé';end if;
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 or not exists(select 1 from public.jobs where id=p_job and company_id=p_company) then raise exception 'Identité, établissement et motif requis';end if;
 perform private.validate_missing_day(p_start,p_end,p_breaks);
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||p_company::text,0));
 select * into r from public.essential_missing_days where id=p_request;
 if found then
  if r.requested_by<>auth.uid() or r.company_id<>p_company or r.worker_id<>p_worker or r.job_id<>p_job or r.starts_at<>p_start or r.ends_at<>p_end or r.breaks<>p_breaks or r.reason<>trim(p_reason) then raise exception 'Identifiant déjà utilisé';end if;return r.id;
 end if;
 perform private.assert_open_period(p_company,p_start,p_end);
 if exists(select 1 from public.punch_sessions where company_id=p_company and (worker_id=p_worker or (w.auth_user_id is not null and user_id=w.auth_user_id)) and tstzrange(started_at,ended_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'Un pointage existe déjà sur cette période';end if;
 if exists(select 1 from public.essential_missing_days where company_id=p_company and worker_id=p_worker and status='pending' and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'Une demande est déjà en attente pour cette période';end if;
 insert into public.essential_missing_days(id,company_id,worker_id,job_id,requested_by,starts_at,ends_at,breaks,reason) values(p_request,p_company,p_worker,p_job,auth.uid(),p_start,p_end,p_breaks,trim(p_reason));
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'missing_day_requested',p_request,jsonb_build_object('worker',p_worker,'start',p_start,'end',p_end),trim(p_reason));
 return p_request;
end $$;
revoke all on function public.request_essential_missing_day(uuid,uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text) from public,anon;
grant execute on function public.request_essential_missing_day(uuid,uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text) to authenticated;
