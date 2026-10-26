-- Internal-only and idempotent reminders for a single ISO week.
-- No SMS, email, publishing or worker assignment. Private ledger prevents duplicate pushes.
create table private.essential_availability_reminder_deliveries (
 company_id uuid not null,
 worker_id uuid not null,
 week_start date not null,
 notification_id uuid not null references public.app_notifications(id),
 created_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,worker_id,week_start),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
alter table private.essential_availability_reminder_deliveries enable row level security;
revoke all on private.essential_availability_reminder_deliveries from public,anon,authenticated;

create function public.essential_availability_reminder_batch(
 p_company uuid,p_week date,p_due date,p_department uuid,p_confirm boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare worker_row record;time_zone text;notification uuid;v_sent integer:=0;
 v_pending integer:=0;v_declared integer:=0;v_undeliverable integer:=0;
 v_already_sent integer:=0;v_total integer:=0;
begin
 if p_company is null or p_week is null or p_due is null or p_confirm is null
  or extract(isodow from p_week)::integer<>1
  or p_week<current_date-interval '6 days' or p_week>current_date+interval '90 days'
  or p_due<current_date or p_due>p_week+6 then
  raise exception using errcode='22023',message='Choisissez le lundi de la semaine et une échéance valide (90 jours max).';
 end if;
 if not private.is_manager(p_company) or not private.essential_feature(p_company,'availability') then
  raise exception using errcode='42501',message='Rappels de disponibilité réservés au Boss/Admin habilité';
 end if;
 if p_department is not null and not exists(
   select 1 from public.essential_departments d where d.company_id=p_company and d.id=p_department and d.active
 ) then raise exception using errcode='42501',message='Département hors de la compagnie';end if;
 if (select count(*) from public.company_workers w where w.company_id=p_company and w.status='active'
      and (p_department is null or w.department_id=p_department)
      and not exists(select 1 from public.company_members m where m.company_id=w.company_id and m.user_id=w.auth_user_id and m.role in ('boss','admin')))>250 then
  raise exception using errcode='22023',message='Plus de 250 salariés : sélectionner un département';
 end if;
 if p_confirm then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('availability_reminder:'||p_company::text||':'||p_week::text,0));
 end if;
 for worker_row in
  select w.id,w.auth_user_id,w.personal_access,w.location_id,m.status as membership_status
  from public.company_workers w
  left join public.company_members m on m.company_id=w.company_id and m.user_id=w.auth_user_id
  where w.company_id=p_company and w.status='active' and (p_department is null or w.department_id=p_department)
   and (m.role is null or m.role not in ('boss','admin'))
  order by w.id
 loop
  v_total:=v_total+1;
  select timezone into time_zone from public.essential_locations l
  where l.company_id=p_company and l.id=worker_row.location_id and l.active;
  if time_zone is null then select timezone into time_zone from public.essential_locations where company_id=p_company and active order by id limit 1;end if;
  time_zone:=coalesce(time_zone,'UTC');
  -- A declared week type (including "unavailable") or dated entry for the week counts
  -- as a response; this batch only nudges workers with *no* declaration.
  if exists(select 1 from public.essential_weekly_availability a where a.company_id=p_company
     and a.worker_id=worker_row.id and a.active and a.effective_from<=p_week+6
     and (a.effective_until is null or a.effective_until>=p_week))
   or exists(select 1 from public.essential_availability a where a.company_id=p_company
     and a.worker_id=worker_row.id and a.starts_at<((p_week+7)::timestamp at time zone time_zone)
     and a.ends_at>(p_week::timestamp at time zone time_zone))
  then v_declared:=v_declared+1;
  elsif worker_row.auth_user_id is null or not worker_row.personal_access
    or worker_row.membership_status is distinct from 'active'
  then v_undeliverable:=v_undeliverable+1;
  elsif exists(select 1 from private.essential_availability_reminder_deliveries a
    where a.company_id=p_company and a.worker_id=worker_row.id and a.week_start=p_week)
  then v_already_sent:=v_already_sent+1;
  else
   v_pending:=v_pending+1;
   if p_confirm then
    insert into public.app_notifications(company_id,recipient_id,kind,title,body)
    values(p_company,worker_row.auth_user_id,'availability_reminder',
      'Disponibilités demandées',
      'Veuillez indiquer vos disponibilités pour la semaine du '||to_char(p_week,'YYYY-MM-DD')||
      ' avant le '||to_char(p_due,'YYYY-MM-DD')||' dans votre horaire.')
    returning id into notification;
    insert into private.essential_availability_reminder_deliveries
      (company_id,worker_id,week_start,notification_id,created_by)
    values(p_company,worker_row.id,p_week,notification,auth.uid());
    v_sent:=v_sent+1;
   end if;
  end if;
 end loop;
 if p_confirm then
  insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
  values(p_company,auth.uid(),'availability_reminders_sent',p_company,
  jsonb_build_object('week',p_week,'deadline',p_due,'department_id',p_department,
    'sent',v_sent,'already_sent',v_already_sent,'without_account',v_undeliverable),
  'Rappel interne uniquement; aucune modification aux quarts ou contrats');
 end if;
 return jsonb_build_object('week',p_week,'deadline',p_due,'total',v_total,
   'with_declaration',v_declared,'without_account',v_undeliverable,
   'already_sent',v_already_sent,'pending',v_pending,'sent',v_sent,
   'confirmed',p_confirm,'channel','internal','no_sms',true);
end $$;
revoke all on function public.essential_availability_reminder_batch(uuid,date,date,uuid,boolean) from public,anon;
grant execute on function public.essential_availability_reminder_batch(uuid,date,date,uuid,boolean) to authenticated;
