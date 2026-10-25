-- Keep the existing transactional review engines and their self-approval/payroll guards.
do $migration$
declare item record;source text;changed text;
begin
 for item in select * from (values
 ('public.review_punch_correction(uuid,boolean,text)','(select worker_id from public.punch_sessions where id=r.session_id)','time'),
 ('public.review_essential_break_correction(uuid,boolean,text)','(select worker_id from public.punch_sessions where id=r.session_id)','time'),
 ('public.review_essential_missing_day(uuid,boolean,text)','r.worker_id','time'),
 ('public.review_leave(uuid,boolean,text)','(select id from public.company_workers where company_id=r.company_id and auth_user_id=r.user_id)','leave')
 ) functions(signature,worker_expression,kind) loop
  source:=pg_get_functiondef(item.signature::regprocedure);
  changed:=replace(source,'not private.can_administer(r.company_id)','not private.essential_can_approve_worker(r.company_id,'||item.worker_expression||','||quote_literal(item.kind)||')');
  if changed=source then raise exception 'Review source changed: %',item.signature;end if;
  if item.signature like 'public.review_punch_correction%' then
   changed:=replace(changed,'if s.user_id=auth.uid() then','if s.user_id=auth.uid() or (not private.is_manager(r.company_id) and r.requested_by=auth.uid()) then');
  end if;
  execute changed;
 end loop;
end $migration$;
create index supervisor_time_pending on public.punch_correction_requests(company_id,created_at desc) where status='pending';
create index supervisor_leave_pending on public.leave_requests(company_id,created_at desc) where status='pending';
create function public.supervisor_approval_inbox(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 -- Purpose-specific, minimal output; raw worker/contact/pay tables remain closed by RLS.
 return coalesce((select jsonb_agg(row order by row->>'created_at' desc) from (
 (select jsonb_build_object('kind','time','id',r.id,'worker',w.first_name||' '||w.last_name,'reason',r.reason,'start',coalesce(r.requested_start,s.started_at),'end',coalesce(r.requested_end,s.ended_at),'before_start',s.started_at,'before_end',s.ended_at,'created_at',r.created_at) as row
 from public.punch_correction_requests r join public.punch_sessions s on s.id=r.session_id and s.company_id=r.company_id join public.company_workers w on w.id=s.worker_id and w.company_id=r.company_id
 where r.company_id=p_company and r.status='pending' and r.requested_by<>auth.uid() and w.auth_user_id is distinct from auth.uid() and private.essential_can_approve_worker(r.company_id,w.id,'time') order by r.created_at desc limit 100)
 union all
 (select jsonb_build_object('kind','pause','id',r.id,'worker',w.first_name||' '||w.last_name,'reason',r.reason,'start',r.requested_start,'end',r.requested_end,'paid',r.requested_paid,'created_at',r.created_at) as row
 from public.essential_break_corrections r join public.punch_sessions s on s.id=r.session_id and s.company_id=r.company_id join public.company_workers w on w.id=s.worker_id and w.company_id=r.company_id
 where r.company_id=p_company and r.status='pending' and r.requested_by<>auth.uid() and w.auth_user_id is distinct from auth.uid() and private.essential_can_approve_worker(r.company_id,w.id,'time') order by r.created_at desc limit 100)
 union all
 (select jsonb_build_object('kind','day','id',r.id,'worker',w.first_name||' '||w.last_name,'reason',r.reason,'start',r.starts_at,'end',r.ends_at,'breaks',r.breaks,'created_at',r.created_at) as row
 from public.essential_missing_days r join public.company_workers w on w.id=r.worker_id and w.company_id=r.company_id
 where r.company_id=p_company and r.status='pending' and r.requested_by<>auth.uid() and w.auth_user_id is distinct from auth.uid() and private.essential_can_approve_worker(r.company_id,w.id,'time') order by r.created_at desc limit 100)
 union all
 (select jsonb_build_object('kind','leave','id',r.id,'worker',w.first_name||' '||w.last_name,'reason',r.reason,'start',r.begins_on,'end',r.ends_on,'leave_type',r.leave_type,'created_at',r.created_at) as row
 from public.leave_requests r join public.company_workers w on w.auth_user_id=r.user_id and w.company_id=r.company_id
 where r.company_id=p_company and r.status='pending' and r.user_id<>auth.uid() and private.essential_can_approve_worker(r.company_id,w.id,'leave') order by r.created_at desc limit 100)
 ) requests),'[]');
end $$;
revoke all on function public.supervisor_approval_inbox(uuid) from public,anon;
grant execute on function public.supervisor_approval_inbox(uuid) to authenticated;
