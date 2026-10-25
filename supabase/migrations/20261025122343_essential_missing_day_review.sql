create function public.review_essential_missing_day(p_request uuid,p_approve boolean,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.essential_missing_days;w public.company_workers;s uuid;pause jsonb;
begin
 select * into r from public.essential_missing_days where id=p_request;
 if not found or not private.can_administer(r.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 if p_approve is null or length(trim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'Décision et motif requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||r.company_id::text,0));
 select * into r from public.essential_missing_days where id=p_request for update;
 select * into w from public.company_workers where id=r.worker_id and company_id=r.company_id;
 if r.requested_by=auth.uid() or w.auth_user_id=auth.uid() then raise exception 'Autoapprobation interdite';end if;
 if r.status<>'pending' then
  if r.reviewed_by=auth.uid() and r.status=(case when p_approve then 'approved' else 'rejected' end) and r.review_note=trim(p_note) then return r.session_id;end if;
  raise exception 'Demande déjà traitée';
 end if;
 if p_approve then
  if w.status<>'active' then raise exception 'Salarié inactif';end if;
  perform pg_advisory_xact_lock(hashtextextended(r.company_id::text||coalesce(w.auth_user_id,w.id)::text,0));
  perform private.validate_missing_day(r.starts_at,r.ends_at,r.breaks);perform private.assert_open_period(r.company_id,r.starts_at,r.ends_at);
  if exists(select 1 from public.punch_sessions where company_id=r.company_id and (worker_id=w.id or (w.auth_user_id is not null and user_id=w.auth_user_id)) and tstzrange(started_at,ended_at,'[)')&&tstzrange(r.starts_at,r.ends_at,'[)')) then raise exception 'Pointage ajouté depuis la demande : conflit à résoudre';end if;
  insert into public.punch_sessions(company_id,worker_id,user_id,started_at,ended_at) values(r.company_id,w.id,w.auth_user_id,r.starts_at,r.ends_at) returning id into s;
  insert into public.punch_segments(company_id,session_id,job_id,started_at,ended_at) values(r.company_id,s,r.job_id,r.starts_at,r.ends_at);
  for pause in select value from jsonb_array_elements(r.breaks) loop
   insert into public.punch_breaks(company_id,session_id,user_id,started_at,ended_at,is_paid) values(r.company_id,s,w.auth_user_id,(pause->>'start')::timestamptz,(pause->>'end')::timestamptz,(pause->>'paid')::boolean);
  end loop;
 end if;
 update public.essential_missing_days set status=case when p_approve then 'approved' else 'rejected' end,session_id=s,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(r.company_id,auth.uid(),'missing_day_review',r.id,to_jsonb(r),jsonb_build_object('approved',p_approve,'session',s),trim(p_note));
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select r.company_id,m.user_id,'missing_day_decision',case when p_approve then 'Journée oubliée approuvée' else 'Journée oubliée refusée' end,trim(p_note) from public.company_members m where m.company_id=r.company_id and m.status='active' and (m.user_id=r.requested_by or m.user_id=w.auth_user_id);
 return s;
end $$;
create function public.cancel_essential_missing_day(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_missing_days;
begin
 select * into r from public.essential_missing_days where id=p_request;
 if not found or r.requested_by<>auth.uid() or not private.is_member(r.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||r.company_id::text,0));
 update public.essential_missing_days set status='cancelled',reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note='Annulation par le demandeur' where id=p_request and status='pending';
 if not found then raise exception 'Demande déjà traitée';end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(r.company_id,auth.uid(),'missing_day_cancelled',r.id,'Annulation par le demandeur');
end $$;
revoke all on function public.review_essential_missing_day(uuid,boolean,text),public.cancel_essential_missing_day(uuid) from public,anon;
grant execute on function public.review_essential_missing_day(uuid,boolean,text),public.cancel_essential_missing_day(uuid) to authenticated;
create function private.check_pending_missing_days() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reopened_at is null and exists(select 1 from public.essential_missing_days where company_id=new.company_id and status='pending' and starts_at<((new.week_start+7)::timestamp at time zone 'America/Toronto') and ends_at>(new.week_start::timestamp at time zone 'America/Toronto')) then raise exception 'Traiter les journées oubliées avant de fermer la semaine';end if;return new;
end $$;
revoke all on function private.check_pending_missing_days() from public,anon,authenticated;
create trigger pending_missing_days before insert or update on public.payroll_weeks for each row execute function private.check_pending_missing_days();
-- Preserve pending/decision history in subsequent archives; never automatically reapply a decision.
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$select 'public.essential_break_corrections' as collection$old$,$new$select 'public.essential_missing_days' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_missing_days t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_break_corrections' as collection$new$);
 if changed=source then raise exception 'Archive snapshot changed: inspect before migration';end if;execute changed;
end $migration$;
