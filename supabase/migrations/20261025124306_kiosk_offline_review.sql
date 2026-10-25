create function public.list_kiosk_offline(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_manager(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 return coalesce((select jsonb_agg(row order by row->>'issued_at' desc) from (select jsonb_build_object('id',g.id,'worker',w.first_name||' '||w.last_name,'worker_id',w.id,'issued_at',g.issued_at,'closed_at',g.closed_at,'device',d.name,'events',(select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.occurred_at,'state',e.state,'note',e.review_note) order by e.sequence) from private.kiosk_offline_events e where e.grant_id=g.id)) as row from private.kiosk_offline_grants g join public.company_workers w on w.id=g.worker_id join private.kiosk_devices d on d.id=g.device_id where g.company_id=p_company and exists(select 1 from private.kiosk_offline_events e where e.grant_id=g.id) order by g.issued_at desc limit 100) rows),'[]');
end $$;
create function public.review_kiosk_offline(p_grant uuid,p_approve boolean,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.kiosk_offline_grants;w public.company_workers;ev private.kiosk_offline_events;sid uuid;paused boolean;current_break uuid;start_at timestamptz;created integer:=0;current_baseline jsonb;
begin
 select * into g from private.kiosk_offline_grants where id=p_grant;
 if not found or not private.can_administer(g.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 if p_approve is null or length(trim(coalesce(p_note,''))) not between 3 and 1000 then raise exception 'Décision et motif requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||g.company_id::text,0));
 select * into g from private.kiosk_offline_grants where id=p_grant for update;
 select * into w from public.company_workers where id=g.worker_id and company_id=g.company_id;
 if w.auth_user_id=auth.uid() then raise exception 'Autoapprobation interdite';end if;
 if g.closed_at is not null then raise exception 'Lot déjà traité';end if;
 if not exists(select 1 from private.kiosk_offline_events where grant_id=g.id and state='pending') then raise exception 'Aucune observation en attente';end if;
 perform pg_advisory_xact_lock(hashtextextended(g.company_id::text||coalesce(w.auth_user_id,w.id)::text,0));
 if p_approve then
  if w.status<>'active' or not w.can_kiosk_punch or exists(select 1 from private.kiosk_devices where id=g.device_id and revoked_at is not null) or not exists(select 1 from private.worker_pin_secrets where worker_id=w.id and updated_at=g.pin_stamp) then raise exception 'Identité ou appareil révoqué';end if;
  current_baseline:=private.kiosk_offline_baseline(g.company_id,w.id);
  if current_baseline is distinct from g.baseline then raise exception 'Conflit : pointage modifié sur un autre appareil';end if;
  sid:=(g.baseline->'session'->>'id')::uuid;start_at:=(g.baseline->'session'->>'started_at')::timestamptz;
  select id into current_break from public.punch_breaks where session_id=sid and ended_at is null;paused:=current_break is not null;
  for ev in select * from private.kiosk_offline_events where grant_id=g.id and state='pending' order by sequence loop
   if ev.action='in' then
    if sid is not null then raise exception 'Conflit : journée déjà active';end if;
    start_at:=ev.occurred_at;perform private.assert_open_period(g.company_id,start_at,start_at+interval '1 microsecond');
    if exists(select 1 from public.punch_sessions where company_id=g.company_id and (worker_id=w.id or (w.auth_user_id is not null and user_id=w.auth_user_id)) and tstzrange(started_at,ended_at,'[)') @> start_at) then raise exception 'Chevauchement avec les heures officielles';end if;
    insert into public.punch_sessions(company_id,worker_id,user_id,started_at) values(g.company_id,w.id,w.auth_user_id,start_at) returning id into sid;
    insert into public.punch_segments(company_id,session_id,job_id,started_at) values(g.company_id,sid,g.job_id,start_at);
    created:=created+1;
   elsif sid is null then raise exception 'Séquence incomplète : aucune journée active';
   elsif ev.action in('break_start','break_start_paid') then
    if paused then raise exception 'Séquence de pauses incompatible';end if;
    insert into public.punch_breaks(company_id,session_id,user_id,started_at,is_paid) values(g.company_id,sid,w.auth_user_id,ev.occurred_at,ev.action='break_start_paid') returning id into current_break;paused:=true;
   elsif ev.action='break_end' then
    if not paused then raise exception 'Aucune pause active';end if;
    update public.punch_breaks set ended_at=ev.occurred_at where id=current_break;paused:=false;current_break:=null;
   elsif ev.action='out' then
    perform private.assert_open_period(g.company_id,start_at,ev.occurred_at);
    if ev.occurred_at<=start_at or ev.occurred_at-start_at>interval '26 hours' or exists(select 1 from public.punch_sessions where company_id=g.company_id and id<>sid and (worker_id=w.id or (w.auth_user_id is not null and user_id=w.auth_user_id)) and tstzrange(started_at,ended_at,'[)')&&tstzrange(start_at,ev.occurred_at,'[)')) then raise exception 'Chevauchement ou durée invalide';end if;
    update public.punch_breaks set ended_at=ev.occurred_at where session_id=sid and ended_at is null;
    update public.punch_segments set ended_at=ev.occurred_at where session_id=sid and ended_at is null;
    update public.punch_sessions set ended_at=ev.occurred_at where id=sid;
    paused:=false;current_break:=null;sid:=null;
   end if;
   update private.kiosk_offline_events set session_id=coalesce(sid,(select session_id from public.punch_segments where company_id=g.company_id and started_at=start_at and job_id=g.job_id limit 1)) where id=ev.id;
  end loop;
  if sid is not null then raise exception 'Journée encore ouverte : synchroniser la sortie avant de confirmer';end if;
 end if;
 update private.kiosk_offline_events set state=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where grant_id=g.id and state='pending';
 update private.kiosk_offline_grants set closed_at=clock_timestamp() where id=g.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(g.company_id,auth.uid(),'kiosk_offline_review',g.id,jsonb_build_object('approved',p_approve,'new_sessions',created),trim(p_note));
 return jsonb_build_object('approved',p_approve,'new_sessions',created);
end $$;
revoke all on function public.list_kiosk_offline(uuid),public.review_kiosk_offline(uuid,boolean,text) from public,anon;
grant execute on function public.list_kiosk_offline(uuid),public.review_kiosk_offline(uuid,boolean,text) to authenticated;
