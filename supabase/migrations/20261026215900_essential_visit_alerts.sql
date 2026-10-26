-- NAV-007: optional human-reported issues about an assigned visit. Internal-only;
-- never infer delay from GPS, routes, punches or schedule absence.
create table private.essential_visit_alerts(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 shift_id uuid not null references public.scheduled_shifts(id),
 worker_id uuid not null,
 author_id uuid not null references auth.users(id),
 request_id uuid not null,
 kind text not null check(kind in ('possible_delay','access_issue')),
 note text not null default '' check(length(note)<=500),
 status text not null default 'reported' check(status in ('reported','acknowledged')),
 notified_count integer not null default 0,
 created_at timestamptz not null default clock_timestamp(),
 acknowledged_at timestamptz,
 acknowledged_by uuid references auth.users(id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 unique(company_id,author_id,request_id)
);
create index essential_visit_alerts_by_company on private.essential_visit_alerts(company_id,created_at desc);
create index essential_visit_alerts_by_worker on private.essential_visit_alerts(company_id,worker_id,created_at desc);
alter table private.essential_visit_alerts enable row level security;
revoke all on private.essential_visit_alerts from public,anon,authenticated;

create function public.submit_essential_visit_alert(p_shift uuid,p_kind text,p_note text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sh public.scheduled_shifts;v private.essential_visit_alerts;v_count integer;
 v_me uuid:=auth.uid();v_label text;v_note text:=btrim(coalesce(p_note,''));
begin
 if v_me is null or p_shift is null or p_request is null or
    p_kind is null or p_kind not in ('possible_delay','access_issue') or
    length(v_note)>500 then
  raise exception using errcode='22023',message='Quart, type, demande et commentaire valide requis';
 end if;
 select * into sh from public.scheduled_shifts
 where id=p_shift and cancelled_at is null for update;
 if not found then raise exception using errcode='42501',message='Quart non disponible';end if;
 if not private.is_member(sh.company_id) or
    not exists(select 1 from public.companies c where c.id=sh.company_id and c.product_edition='essential') or
    not exists(select 1 from public.company_workers w where w.id=sh.worker_id and w.company_id=sh.company_id
      and w.auth_user_id=v_me and w.status='active' and w.personal_access)
 then raise exception using errcode='42501',message='Seul le salarié affecté peut signaler ce quart';end if;
 if clock_timestamp()<sh.starts_at-interval '48 hours' or clock_timestamp()>sh.ends_at+interval '6 hours' then
  raise exception using errcode='22023',message='Cette visite est hors de la fenêtre de signalement';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(sh.company_id::text||':'||sh.id::text||':'||v_me::text,0));
 select * into v from private.essential_visit_alerts
  where company_id=sh.company_id and author_id=v_me and request_id=p_request for update;
 if found then
  if v.shift_id<>p_shift or v.kind<>p_kind or v.note<>v_note then
   raise exception using errcode='22023',message='Identifiant de demande réutilisé pour un autre signalement';
  end if;
  return jsonb_build_object('id',v.id,'status',v.status,'delivered',v.notified_count,
    'replayed',true,'kind',v.kind);
 end if;
 if (select count(*) from private.essential_visit_alerts a
    where a.company_id=sh.company_id and a.worker_id=sh.worker_id and
      a.shift_id=p_shift and a.created_at>clock_timestamp()-interval '1 hour')>=2 then
  raise exception using errcode='22023',message='Limite de deux signalements par heure atteinte pour cette visite';
 end if;
 if not exists(select 1 from public.company_members m where m.company_id=sh.company_id
     and m.status='active' and m.role in ('boss','admin') and m.user_id<>v_me) then
  raise exception using errcode='22023',message='Aucun responsable disponible pour recevoir le signalement';
 end if;
 insert into private.essential_visit_alerts(company_id,shift_id,worker_id,author_id,request_id,kind,note)
 values(sh.company_id,sh.id,sh.worker_id,v_me,p_request,p_kind,v_note) returning * into v;
 v_label:=case p_kind when 'possible_delay' then 'Retard possible signalé' else 'Problème d’accès signalé' end;
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select sh.company_id,m.user_id,'shift_visit_alert',v_label,
   'Un salarié a signalé un problème pour son quart du '||
   to_char(sh.starts_at at time zone sh.timezone,'YYYY-MM-DD HH24:MI')||
   '. Consultez Horaire pour les détails.'
 from public.company_members m where m.company_id=sh.company_id
   and m.status='active' and m.role in ('boss','admin') and m.user_id<>v_me;
 get diagnostics v_count=row_count;
 update private.essential_visit_alerts set notified_count=v_count where id=v.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(sh.company_id,v_me,'visit_issue_reported',sh.id,
   jsonb_build_object('alert_id',v.id,'kind',v.kind,'recipients',v_count),
   'Signalement volontaire sans calcul GPS/ETA; commentaire privé exclu');
 return jsonb_build_object('id',v.id,'status','reported','delivered',v_count,
   'replayed',false,'kind',v.kind);
end $$;

create function public.list_essential_visit_alerts(p_company uuid,p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not private.is_member(p_company) then
  raise exception using errcode='42501',message='Compagnie non autorisée';
 end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days' then
  raise exception using errcode='22023',message='Période de signalements invalide, maximum 31 jours';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_result from(
   select a.id,a.company_id,a.shift_id,a.worker_id,a.kind,a.note,a.status,a.created_at,
     a.acknowledged_at,a.notified_count,
     w.first_name||' '||w.last_name as employee_name
   from private.essential_visit_alerts a
   join public.company_workers w on w.company_id=a.company_id and w.id=a.worker_id
   where a.company_id=p_company and a.created_at>=p_from and a.created_at<p_to
    and (private.is_manager(p_company) or a.author_id=auth.uid())
   order by a.created_at desc limit 200
 )t;
 return jsonb_build_object('items',v_result,'limited',jsonb_array_length(v_result)>=200);
end $$;

create function public.acknowledge_essential_visit_alert(p_alert uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.essential_visit_alerts;
begin
 if p_alert is null then raise exception using errcode='22023',message='Signalement requis';end if;
 select * into v from private.essential_visit_alerts where id=p_alert for update;
 if not found or not private.is_manager(v.company_id) then
  raise exception using errcode='42501',message='Signalement réservé au responsable de cette compagnie';
 end if;
 if v.status='acknowledged' then
  return jsonb_build_object('id',v.id,'status',v.status,'unchanged',true);
 end if;
 update private.essential_visit_alerts
  set status='acknowledged',acknowledged_at=clock_timestamp(),acknowledged_by=auth.uid()
 where id=v.id;
 if exists(select 1 from public.company_members m where m.company_id=v.company_id
  and m.user_id=v.author_id and m.status='active') then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(v.company_id,v.author_id,'shift_visit_alert_acknowledged',
   'Signalement pris en charge','Votre responsable a pris connaissance de votre signalement de visite.');
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(v.company_id,auth.uid(),'visit_issue_acknowledged',v.shift_id,
   jsonb_build_object('alert_id',v.id,'kind',v.kind),
   'Avis pris en charge, aucun changement aux heures ni au pointage');
 return jsonb_build_object('id',v.id,'status','acknowledged','unchanged',false);
end $$;
revoke all on function public.submit_essential_visit_alert(uuid,text,text,uuid) from public,anon;
revoke all on function public.list_essential_visit_alerts(uuid,timestamptz,timestamptz) from public,anon;
revoke all on function public.acknowledge_essential_visit_alert(uuid) from public,anon;
grant execute on function public.submit_essential_visit_alert(uuid,text,text,uuid) to authenticated;
grant execute on function public.list_essential_visit_alerts(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.acknowledge_essential_visit_alert(uuid) to authenticated;
