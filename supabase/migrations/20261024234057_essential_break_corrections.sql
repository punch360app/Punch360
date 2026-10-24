-- Essential-only pause corrections; immutable requests and original snapshots.
create table public.essential_break_corrections (
 id uuid primary key,company_id uuid not null references public.companies(id),
 session_id uuid not null,break_id uuid references public.punch_breaks(id),
 requested_by uuid not null references auth.users(id),
 requested_start timestamptz not null,requested_end timestamptz not null,requested_paid boolean not null,
 original_break jsonb,original_session jsonb not null,reason text not null check(length(trim(reason)) between 3 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default clock_timestamp(),reviewed_by uuid references auth.users(id),reviewed_at timestamptz,review_note text,
 foreign key(company_id,session_id) references public.punch_sessions(company_id,id),check(requested_end>requested_start)
);
create unique index essential_break_pending on public.essential_break_corrections(break_id) where status='pending' and break_id is not null;
create index essential_break_requests_company on public.essential_break_corrections(company_id,created_at desc);
create index essential_break_requests_session on public.essential_break_corrections(session_id,status);
alter table public.essential_break_corrections enable row level security;
create policy break_requests_read on public.essential_break_corrections for select to authenticated using(private.is_member(company_id) and (private.is_manager(company_id) or requested_by=(select auth.uid()) or exists(select 1 from public.punch_sessions s left join public.company_workers w on w.id=s.worker_id where s.id=session_id and (s.user_id=(select auth.uid()) or w.auth_user_id=(select auth.uid())))));
grant select on public.essential_break_corrections to authenticated;
revoke insert,update,delete on public.essential_break_corrections from anon,authenticated;

create function public.request_essential_break_correction(p_request uuid,p_session uuid,p_break uuid,p_start timestamptz,p_end timestamptz,p_paid boolean,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.punch_sessions;b public.punch_breaks;r public.essential_break_corrections;own_worker boolean;old_break jsonb;
begin
 select * into s from public.punch_sessions where id=p_session;
 if not found or not private.is_member(s.company_id) or not exists(select 1 from public.companies where id=s.company_id and product_edition='essential') then raise exception using errcode='42501',message='Accès refusé';end if;
 own_worker:=s.user_id=auth.uid() or exists(select 1 from public.company_workers where id=s.worker_id and auth_user_id=auth.uid() and status='active');
 if not coalesce(own_worker,false) and not private.can_administer(s.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 if p_request is null or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_paid is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Période et motif valides requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll:'||s.company_id::text,0));
 select * into r from public.essential_break_corrections where id=p_request;
 if found then
  if r.requested_by<>auth.uid() or r.session_id<>p_session or r.break_id is distinct from p_break or r.requested_start<>p_start or r.requested_end<>p_end or r.requested_paid<>p_paid or r.reason<>trim(p_reason) then raise exception 'Identifiant de demande déjà utilisé';end if;
  return r.id;
 end if;
 select * into s from public.punch_sessions where id=p_session for update;
 if s.ended_at is null or p_start<s.started_at or p_end>s.ended_at or p_end>clock_timestamp() then raise exception 'Pause à l’intérieur d’une journée terminée requise';end if;
 perform private.assert_open_period(s.company_id,s.started_at,s.ended_at);
 if p_break is not null then
  select * into b from public.punch_breaks where id=p_break and session_id=s.id and company_id=s.company_id;
  if not found or b.ended_at is null then raise exception 'Pause terminée introuvable';end if;old_break:=to_jsonb(b);
  if b.started_at=p_start and b.ended_at=p_end and b.is_paid=p_paid then raise exception 'Aucune modification demandée';end if;
 end if;
 if exists(select 1 from public.punch_breaks where session_id=s.id and id is distinct from p_break and tstzrange(started_at,ended_at,'[)') && tstzrange(p_start,p_end,'[)')) then raise exception 'Chevauchement de pauses';end if;
 insert into public.essential_break_corrections(id,company_id,session_id,break_id,requested_by,requested_start,requested_end,requested_paid,original_break,original_session,reason) values(p_request,s.company_id,s.id,p_break,auth.uid(),p_start,p_end,p_paid,old_break,jsonb_build_object('started_at',s.started_at,'ended_at',s.ended_at),trim(p_reason));
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(s.company_id,auth.uid(),'break_correction_requested',p_request,old_break,jsonb_build_object('started_at',p_start,'ended_at',p_end,'is_paid',p_paid),trim(p_reason));
 return p_request;
end $$;

create function public.review_essential_break_correction(p_request uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_break_corrections;s public.punch_sessions;b public.punch_breaks;result_id uuid;
begin
 select * into r from public.essential_break_corrections where id=p_request;
 if not found or not private.can_administer(r.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 if p_approve is null or length(trim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'Décision et motif requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll:'||r.company_id::text,0));
 select * into r from public.essential_break_corrections where id=p_request for update;
 if r.status<>'pending' then raise exception 'Demande déjà traitée';end if;
 select * into s from public.punch_sessions where id=r.session_id for update;
 if r.requested_by=auth.uid() or s.user_id=auth.uid() or exists(select 1 from public.company_workers where id=s.worker_id and auth_user_id=auth.uid()) then raise exception 'Autoapprobation interdite';end if;
 if p_approve then
  perform private.assert_open_period(s.company_id,s.started_at,s.ended_at);
  if s.ended_at is null or jsonb_build_object('started_at',s.started_at,'ended_at',s.ended_at)<>r.original_session then raise exception 'Journée modifiée : annuler et soumettre une nouvelle demande';end if;
  if r.break_id is not null then
   select * into b from public.punch_breaks where id=r.break_id for update;
   if not found or to_jsonb(b)<>r.original_break then raise exception 'Pause modifiée : annuler et soumettre une nouvelle demande';end if;
  end if;
  if r.requested_start<s.started_at or r.requested_end>s.ended_at or exists(select 1 from public.punch_breaks where session_id=s.id and id is distinct from r.break_id and tstzrange(started_at,ended_at,'[)') && tstzrange(r.requested_start,r.requested_end,'[)')) then raise exception 'Période incompatible ou chevauchement de pauses';end if;
  if r.break_id is null then
   insert into public.punch_breaks(company_id,session_id,user_id,started_at,ended_at,is_paid) values(s.company_id,s.id,s.user_id,r.requested_start,r.requested_end,r.requested_paid) returning id into result_id;
  else
   update public.punch_breaks set started_at=r.requested_start,ended_at=r.requested_end,is_paid=r.requested_paid where id=r.break_id;result_id:=r.break_id;
  end if;
  insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(s.company_id,auth.uid(),'break_correction_applied',result_id,r.original_break,jsonb_build_object('started_at',r.requested_start,'ended_at',r.requested_end,'is_paid',r.requested_paid,'request_id',r.id),trim(p_note));
 end if;
 update public.essential_break_corrections set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(r.company_id,auth.uid(),'break_correction_review',r.id,to_jsonb(r),jsonb_build_object('approved',p_approve),trim(p_note));
end $$;

create function public.cancel_essential_break_correction(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_break_corrections;
begin
 select * into r from public.essential_break_corrections where id=p_request;
 if not found or r.requested_by<>auth.uid() or not private.is_member(r.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll:'||r.company_id::text,0));
 update public.essential_break_corrections set status='cancelled',reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note='Annulation par le demandeur' where id=p_request and status='pending';
 if not found then raise exception 'Demande déjà traitée';end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(r.company_id,auth.uid(),'break_correction_cancelled',r.id,to_jsonb(r),jsonb_build_object('status','cancelled'),'Annulation par le demandeur');
end $$;

-- A later session correction must not strand its pauses outside the official day.
create function private.essential_check_session_breaks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.ended_at is not null and exists(select 1 from public.companies where id=new.company_id and product_edition='essential') and exists(select 1 from public.punch_breaks where session_id=new.id and (started_at<new.started_at or (new.ended_at is not null and (ended_at is null or ended_at>new.ended_at)))) then raise exception 'Corriger les pauses avant de réduire la journée';end if;return new;
end $$;
create trigger essential_session_break_bounds before update of started_at,ended_at on public.punch_sessions for each row execute function private.essential_check_session_breaks();
revoke all on function private.essential_check_session_breaks() from public,anon,authenticated;
revoke all on function public.request_essential_break_correction(uuid,uuid,uuid,timestamptz,timestamptz,boolean,text),public.review_essential_break_correction(uuid,boolean,text),public.cancel_essential_break_correction(uuid) from public,anon;
grant execute on function public.request_essential_break_correction(uuid,uuid,uuid,timestamptz,timestamptz,boolean,text),public.review_essential_break_correction(uuid,boolean,text),public.cancel_essential_break_correction(uuid) to authenticated;

-- Preserve existing closure checks; add pause requests and integrity checks.
create or replace function public.set_payroll_week(p_company uuid,p_week date,p_close boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
 if not private.can_administer(p_company) then raise exception 'Accès refusé'; end if;
 if extract(isodow from p_week)<>1 or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Lundi et motif requis'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll:'||p_company::text,0));
 select to_jsonb(w) into v_before from public.payroll_weeks w where company_id=p_company and week_start=p_week for update;
 if p_close then
  if (p_week+7)::timestamp at time zone 'America/Toronto'>clock_timestamp() then raise exception 'Semaine non terminée'; end if;
  if exists(select 1 from public.punch_sessions s where s.company_id=p_company and s.ended_at is null
   and s.started_at<((p_week+7)::timestamp at time zone 'America/Toronto')) then raise exception 'Punch ouvert : fermeture impossible'; end if;
  if exists(select 1 from public.punch_correction_requests r join public.punch_sessions s on s.id=r.session_id
   where r.company_id=p_company and r.status='pending'
   and ((s.started_at<((p_week+7)::timestamp at time zone 'America/Toronto') and s.ended_at>(p_week::timestamp at time zone 'America/Toronto'))
    or (r.requested_start<((p_week+7)::timestamp at time zone 'America/Toronto') and r.requested_end>(p_week::timestamp at time zone 'America/Toronto')))) then
    raise exception 'Corrections en attente'; end if;
  if exists(select 1 from public.essential_break_corrections r join public.punch_sessions s on s.id=r.session_id where r.company_id=p_company and r.status='pending' and s.started_at<((p_week+7)::timestamp at time zone 'America/Toronto') and s.ended_at>(p_week::timestamp at time zone 'America/Toronto')) then raise exception 'Corrections de pauses en attente';end if;
  if exists(select 1 from public.punch_breaks b join public.punch_sessions s on s.id=b.session_id join public.companies c on c.id=s.company_id where s.company_id=p_company and c.product_edition='essential' and s.started_at<((p_week+7)::timestamp at time zone 'America/Toronto') and s.ended_at>(p_week::timestamp at time zone 'America/Toronto') and (b.ended_at is null or b.started_at<s.started_at or b.ended_at>s.ended_at or exists(select 1 from public.punch_breaks x where x.session_id=s.id and x.id<>b.id and tstzrange(x.started_at,x.ended_at,'[)') && tstzrange(b.started_at,b.ended_at,'[)')))) then raise exception 'Pauses incohérentes à corriger avant fermeture';end if;
  insert into public.payroll_weeks(company_id,week_start,closed_by,reason) values(p_company,p_week,auth.uid(),trim(p_reason))
   on conflict(company_id,week_start) do update set closed_by=auth.uid(),closed_at=clock_timestamp(),reopened_at=null,reason=excluded.reason;
 else
  update public.payroll_weeks set reopened_at=clock_timestamp(),reason=trim(p_reason) where company_id=p_company and week_start=p_week;
  if not found then raise exception 'Semaine non fermée'; end if;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),case when p_close then 'week_closed' else 'week_reopened' end,p_company,v_before,jsonb_build_object('week',p_week),trim(p_reason));
end $$;

