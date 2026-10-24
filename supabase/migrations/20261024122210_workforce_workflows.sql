-- Official time changes are transactional, audited and never applied on submission.
create table public.workforce_audit (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 actor_id uuid not null references auth.users(id), action text not null, entity_id uuid not null,
 before_value jsonb, after_value jsonb, reason text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.workforce_audit enable row level security;
create policy audit_read on public.workforce_audit for select to authenticated using(private.is_manager(company_id));
grant select on public.workforce_audit to authenticated;

create table public.payroll_weeks (
 company_id uuid not null references public.companies(id), week_start date not null,
 closed_by uuid not null references auth.users(id), closed_at timestamptz not null default clock_timestamp(),
 reopened_at timestamptz, reason text not null, primary key(company_id,week_start),
 check(extract(isodow from week_start)=1)
);
alter table public.payroll_weeks enable row level security;
create policy weeks_read on public.payroll_weeks for select to authenticated using(private.is_member(company_id));
grant select on public.payroll_weeks to authenticated;

create function private.assert_open_period(p_company uuid,p_start timestamptz,p_end timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.payroll_weeks w where w.company_id=p_company and w.reopened_at is null
 and p_start < ((w.week_start+7)::timestamp at time zone 'America/Toronto')
 and p_end > (w.week_start::timestamp at time zone 'America/Toronto')) then
 raise exception 'Semaine fermée : réouverture motivée nécessaire'; end if;
end $$;
revoke all on function private.assert_open_period(uuid,timestamptz,timestamptz) from public,anon,authenticated;

-- Serialized with punch IN/OUT and week closure, prevents races and overlapping time.
create function public.review_punch_correction(p_request uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.punch_correction_requests; s public.punch_sessions; a timestamptz; b timestamptz; first_id uuid; last_id uuid;
begin
 select * into r from public.punch_correction_requests where id=p_request;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('payroll:'||r.company_id::text,0));
 select * into r from public.punch_correction_requests where id=p_request for update;
 if r.status<>'pending' then raise exception 'Demande déjà traitée'; end if;
 select * into s from public.punch_sessions where id=r.session_id and company_id=r.company_id;
 if s.user_id=auth.uid() then raise exception 'Approbation de ses propres heures interdite'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'Motif requis (3 caractères minimum)'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.company_id::text||s.user_id::text,0));
 select * into s from public.punch_sessions where id=r.session_id for update;
 if p_approve then
  if s.ended_at is null then raise exception 'Terminer le punch avant sa correction'; end if;
  a:=coalesce(r.requested_start,s.started_at); b:=coalesce(r.requested_end,s.ended_at);
  if a>=b or b>clock_timestamp() then raise exception 'Période invalide'; end if;
  perform private.assert_open_period(r.company_id,s.started_at,s.ended_at);
  perform private.assert_open_period(r.company_id,a,b);
  if exists(select 1 from public.punch_sessions x where x.company_id=s.company_id and x.user_id=s.user_id and x.id<>s.id
   and tstzrange(x.started_at,x.ended_at,'[)') && tstzrange(a,b,'[)')) then raise exception 'Chevauchement de punchs'; end if;
  select id into first_id from public.punch_segments where session_id=s.id order by started_at,id limit 1;
  select id into last_id from public.punch_segments where session_id=s.id order by started_at desc,id desc limit 1;
  if first_id is null then raise exception 'Segments manquants'; end if;
  if first_id<>last_id and (a>=(select ended_at from public.punch_segments where id=first_id)
   or b<=(select started_at from public.punch_segments where id=last_id)) then
   raise exception 'Correction incompatible avec les transferts de chantier'; end if;
  insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
   values(s.company_id,auth.uid(),'punch_correction',s.id,
    jsonb_build_object('session',to_jsonb(s),'segments',(select jsonb_agg(to_jsonb(ps)) from public.punch_segments ps where ps.session_id=s.id)),
    jsonb_build_object('started_at',a,'ended_at',b,'request_id',r.id),trim(p_note));
  update public.punch_segments set started_at=a where id=first_id;
  update public.punch_segments set ended_at=b where id=last_id;
  update public.punch_sessions set started_at=a,ended_at=b where id=s.id;
 end if;
 update public.punch_correction_requests set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(r.company_id,auth.uid(),'correction_review',r.id,to_jsonb(r),jsonb_build_object('approved',p_approve),trim(p_note));
end $$;

create function public.set_payroll_week(p_company uuid,p_week date,p_close boolean,p_reason text)
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
  insert into public.payroll_weeks(company_id,week_start,closed_by,reason) values(p_company,p_week,auth.uid(),trim(p_reason))
   on conflict(company_id,week_start) do update set closed_by=auth.uid(),closed_at=clock_timestamp(),reopened_at=null,reason=excluded.reason;
 else
  update public.payroll_weeks set reopened_at=clock_timestamp(),reason=trim(p_reason) where company_id=p_company and week_start=p_week;
  if not found then raise exception 'Semaine non fermée'; end if;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),case when p_close then 'week_closed' else 'week_reopened' end,p_company,v_before,jsonb_build_object('week',p_week),trim(p_reason));
end $$;

create function public.review_leave(p_request uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.leave_requests;
begin
 select * into r from public.leave_requests where id=p_request for update;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 if r.user_id=auth.uid() then raise exception 'Approbation de son propre congé interdite'; end if;
 if r.status<>'pending' or length(trim(coalesce(p_note,'')))<3 then raise exception 'Demande traitée ou motif manquant'; end if;
 update public.leave_requests set status=case when p_approve then 'approved' else 'rejected' end where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(r.company_id,auth.uid(),'leave_review',r.id,to_jsonb(r),jsonb_build_object('approved',p_approve),trim(p_note));
end $$;

create function public.advance_material_order(p_order uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.material_orders;
begin
 select * into r from public.material_orders where id=p_order for update;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'Motif requis'; end if;
 if not ((r.status='requested' and p_status in ('approved','rejected')) or (r.status='approved' and p_status='ordered')
 or (r.status='ordered' and p_status='delivered')) then raise exception 'Transition de commande invalide'; end if;
 update public.material_orders set status=p_status where id=p_order;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(r.company_id,auth.uid(),'order_status',r.id,to_jsonb(r),jsonb_build_object('status',p_status),trim(p_note));
end $$;

create table public.document_acknowledgements (
 document_id uuid not null references public.job_documents(id), user_id uuid not null references auth.users(id),
 acknowledged_at timestamptz not null default clock_timestamp(), primary key(document_id,user_id)
);
alter table public.document_acknowledgements enable row level security;
create policy ack_read on public.document_acknowledgements for select to authenticated using(exists(
 select 1 from public.job_documents d where d.id=document_id and private.is_member(d.company_id)
 and (user_id=auth.uid() or private.is_manager(d.company_id))));
create policy ack_add on public.document_acknowledgements for insert to authenticated with check(user_id=auth.uid() and exists(
 select 1 from public.job_documents d where d.id=document_id and private.is_member(d.company_id)));
grant select on public.document_acknowledgements to authenticated;
grant insert(document_id,user_id) on public.document_acknowledgements to authenticated;

revoke all on function public.review_punch_correction(uuid,boolean,text),public.set_payroll_week(uuid,date,boolean,text),public.review_leave(uuid,boolean,text),public.advance_material_order(uuid,text,text) from public,anon;
grant execute on function public.review_punch_correction(uuid,boolean,text),public.set_payroll_week(uuid,date,boolean,text),public.review_leave(uuid,boolean,text),public.advance_material_order(uuid,text,text) to authenticated;
