-- Preserve a precise official-session link even when closing an existing transferred day.
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.review_kiosk_offline(uuid,boolean,text)'::regprocedure);
 changed:=replace(source,'sid uuid;paused boolean;','sid uuid;event_session uuid;paused boolean;');
 changed:=replace(changed,$old$   if ev.action='in' then$old$,$new$   event_session:=sid;
   if ev.action='in' then$new$);
 changed:=replace(changed,'created:=created+1;','created:=created+1;event_session:=sid;');
 changed:=replace(changed,$old$session_id=coalesce(sid,(select session_id from public.punch_segments where company_id=g.company_id and started_at=start_at and job_id=g.job_id limit 1))$old$,'session_id=event_session');
 if changed=source then raise exception 'Review source changed: inspect before migration';end if;execute changed;
end $migration$;
