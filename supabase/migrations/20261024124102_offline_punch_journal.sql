alter table public.punch_location_checks add column offline boolean not null default false;
create table public.punch_event_receipts (
 company_id uuid not null, user_id uuid not null, event_id uuid not null, action text not null,
 job_id uuid, occurred_at timestamptz not null, received_at timestamptz not null default clock_timestamp(),
 offline boolean not null, payload jsonb not null, result jsonb not null,
 primary key(company_id,user_id,event_id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
alter table public.punch_event_receipts enable row level security;
create policy receipts_read on public.punch_event_receipts for select to authenticated
 using(private.is_member(company_id) and (user_id=auth.uid() or private.is_manager(company_id)));
grant select on public.punch_event_receipts to authenticated;
create function public.sync_punch_event(p_event uuid,p_company uuid,p_action text,p_occurred_at timestamptz,
 p_offline boolean,p_job uuid default null,p_latitude double precision default null,p_longitude double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_payload jsonb; v_existing public.punch_event_receipts; v_result jsonb; v_session uuid; v_job uuid;
 v_old_segment uuid; v_new_segment uuid; v_started timestamptz; v_now timestamptz:=clock_timestamp(); v_error text;
begin
 if auth.uid() is null or not private.is_member(p_company) then raise exception 'Accès refusé'; end if;
 if p_event is null or p_occurred_at is null or p_offline is null or p_action is null or p_action not in ('in','out','transfer') then raise exception 'Événement invalide'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text,0));
 v_payload:=jsonb_build_object('action',p_action,'job',p_job,'occurred_at',p_occurred_at,'latitude',p_latitude,'longitude',p_longitude,'accuracy',p_accuracy);
 select * into v_existing from public.punch_event_receipts where company_id=p_company and user_id=auth.uid() and event_id=p_event;
 if found then
  if v_existing.payload<>v_payload then raise exception 'Identifiant déjà utilisé pour un autre événement'; end if;
  return v_existing.result;
 end if;
 begin
  if p_offline then
   if p_occurred_at>v_now+interval '5 minutes' or p_occurred_at<v_now-interval '30 days' then raise exception 'Horloge locale à vérifier'; end if;
   if p_action='in' then
    if exists(select 1 from public.punch_sessions where company_id=p_company and user_id=auth.uid() and (ended_at is null or ended_at>p_occurred_at)) then raise exception 'Entrée hors ligne en conflit avec les heures serveur'; end if;
   else
    select ps.id,ps.started_at into v_old_segment,v_started from public.punch_segments ps join public.punch_sessions s on s.id=ps.session_id
     where s.company_id=p_company and s.user_id=auth.uid() and s.ended_at is null and ps.ended_at is null;
    if v_old_segment is null or p_occurred_at<=v_started then raise exception 'Ordre des événements en conflit'; end if;
   end if;
   perform private.assert_open_period(p_company,case when p_action='in' then p_occurred_at else v_started end,case when p_action='in' then v_now else p_occurred_at end);
  end if;
  v_result:=public.punch_with_location(p_company,p_action,p_job,p_latitude,p_longitude,p_accuracy);
  v_session:=(v_result->>'session_id')::uuid;
  if p_offline then
   if p_action='in' then
    update public.punch_sessions set started_at=p_occurred_at where id=v_session;
    update public.punch_segments set started_at=p_occurred_at where session_id=v_session and ended_at is null;
   elsif p_action='out' then
    update public.punch_segments set ended_at=p_occurred_at where id=v_old_segment;
    update public.punch_sessions set ended_at=p_occurred_at where id=v_session;
   else
    update public.punch_segments set ended_at=p_occurred_at where id=v_old_segment;
    update public.punch_segments set started_at=p_occurred_at where session_id=v_session and ended_at is null;
   end if;
   update public.punch_location_checks set offline=true,review_status='pending' where id=(v_result->>'check_id')::uuid;
   -- One notification per event/manager, even when GPS already created an alert.
   insert into public.app_notifications(company_id,recipient_id,kind,title,body,location_check_id)
   select p_company,m.user_id,'offline_punch','Punch hors ligne synchronisé',
    'Heure locale : '||p_occurred_at::text||'. Vérification de l’administration requise.',(v_result->>'check_id')::uuid
   from public.company_members m where m.company_id=p_company and m.status='active' and m.role in ('boss','admin')
   and not exists(select 1 from public.app_notifications n where n.recipient_id=m.user_id and n.location_check_id=(v_result->>'check_id')::uuid);
   update public.app_notifications set title='Punch hors ligne à valider',body=body||' Heure locale : '||p_occurred_at::text
    where location_check_id=(v_result->>'check_id')::uuid;
   v_result:=v_result||jsonb_build_object('review_status','pending','offline',true);
  end if;
  v_result:=v_result||jsonb_build_object('sync_status','synced','event_id',p_event);
 exception when others then
  get stacked diagnostics v_error=message_text;
  v_result:=jsonb_build_object('sync_status','conflict','event_id',p_event,'message',v_error);
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
   select p_company,m.user_id,'punch_sync_conflict','Conflit de punch à vérifier',p_action||' · '||p_occurred_at::text||' · '||v_error
   from public.company_members m where m.company_id=p_company and m.status='active' and m.role in ('boss','admin');
 end;
 insert into public.punch_event_receipts(company_id,user_id,event_id,action,job_id,occurred_at,offline,payload,result)
 values(p_company,auth.uid(),p_event,p_action,p_job,p_occurred_at,p_offline,v_payload,v_result);
 return v_result;
end $$;
revoke all on function public.sync_punch_event(uuid,uuid,text,timestamptz,boolean,uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.sync_punch_event(uuid,uuid,text,timestamptz,boolean,uuid,double precision,double precision,double precision) to authenticated;
