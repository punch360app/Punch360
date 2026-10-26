-- Essentiel Plus/Pro: employee-initiated absence on a *published shift*.
-- Reasons remain private. This does NOT approve leave, alter punches, or offer replacements.
create table private.essential_shift_absences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  shift_id uuid not null,
  worker_id uuid not null,
  shift_version integer not null,
  request_id uuid not null,
  reason_code text not null check (reason_code in (
    'illness','child_illness','medical_appointment','family_emergency',
    'family_care','transport','personal','other','undisclosed'
  )),
  private_note text not null default '' check (char_length(private_note)<=400),
  status text not null default 'reported' check(status in ('reported','acknowledged','follow_up')),
  reported_by uuid not null,
  reported_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  unique (company_id,shift_id),
  unique (company_id,request_id),
  foreign key (company_id,shift_id) references public.scheduled_shifts(company_id,id),
  foreign key (company_id,worker_id) references public.company_workers(company_id,id)
);
create index essential_absences_company_time on private.essential_shift_absences(company_id,reported_at desc);
alter table private.essential_shift_absences enable row level security;
-- No direct SELECT, UPDATE, DELETE to employees, leads, or managers.
revoke all on private.essential_shift_absences from public,anon,authenticated;

create function public.report_essential_shift_absence(
 p_shift uuid,p_expected_version integer,p_reason text,p_note text,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.scheduled_shifts; w public.company_workers; a private.essential_shift_absences; v_new boolean:=false;
begin
 if auth.uid() is null or p_shift is null or p_request is null or
    p_reason is null or p_reason not in ('illness','child_illness','medical_appointment','family_emergency','family_care','transport','personal','other','undisclosed') or
    p_note is null or char_length(p_note)>400 then
  raise exception using errcode='22023',message='Signalement invalide';
 end if;
 select * into s from public.scheduled_shifts where id=p_shift for update;
 if not found or not private.is_member(s.company_id) or
    not private.essential_feature(s.company_id,'advanced_schedules') then
  raise exception using errcode='42501',message='Signalement non autorisé';
 end if;
 select * into w from public.company_workers
  where company_id=s.company_id and id=s.worker_id and auth_user_id=auth.uid()
    and status='active' and personal_access for update;
 if not found then raise exception using errcode='42501',message='Quart personnel requis';end if;
 -- A retry for an already reported shift is harmless and cannot trigger new notices.
 select * into a from private.essential_shift_absences
  where company_id=s.company_id and shift_id=s.id for update;
 if found then
  return jsonb_build_object('id',a.id,'status',a.status,'shift_id',a.shift_id,'duplicate',true);
 end if;
 if exists(select 1 from private.essential_shift_absences where company_id=s.company_id and request_id=p_request) then
  raise exception using errcode='23505',message='Réessai lié à un autre quart';
 end if;
 if s.cancelled_at is not null or s.worker_id is distinct from w.id or
    s.version is distinct from p_expected_version or s.ends_at<=clock_timestamp() or
    s.starts_at>clock_timestamp()+interval '90 days' then
  raise exception using errcode='22023',message='Ce quart a changé ou ne peut plus être signalé';
 end if;
 insert into private.essential_shift_absences
  (company_id,shift_id,worker_id,shift_version,request_id,reason_code,private_note,reported_by)
 values(s.company_id,s.id,w.id,s.version,p_request,p_reason,trim(p_note))
 returning * into a;
 -- Neither the private category nor free text appears in notifications or audit.
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(s.company_id,auth.uid(),'shift_absence_reported',a.id,
        jsonb_build_object('shift_id',s.id,'worker_id',w.id,'version',s.version),
        'Signalement explicite de l’employé');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select s.company_id,m.user_id,'shift_absence','Absence signalée',
        'Un quart planifié nécessite une vérification dans Horaire.'
 from public.company_members m
 where m.company_id=s.company_id and m.status='active' and m.role in ('boss','admin')
       and m.user_id<>auth.uid();
 return jsonb_build_object('id',a.id,'status',a.status,'shift_id',a.shift_id,'duplicate',false);
end $$;

create function public.list_essential_shift_absences(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_manager boolean; result jsonb;
begin
 if p_company is null or not private.is_member(p_company) or
    not private.essential_feature(p_company,'advanced_schedules') then
  raise exception using errcode='42501',message='Accès aux absences refusé';
 end if;
 v_manager:=private.is_manager(p_company);
 select coalesce(jsonb_agg(jsonb_build_object(
     'id',a.id,'shift_id',a.shift_id,'worker_id',a.worker_id,
     'status',a.status,'reported_at',a.reported_at,'reviewed_at',a.reviewed_at
   ) order by a.reported_at desc),'[]'::jsonb)
 into result from (
   select a.id,a.shift_id,a.worker_id,a.status,a.reported_at,a.reviewed_at
   from private.essential_shift_absences a
   join public.scheduled_shifts s on s.id=a.shift_id and s.company_id=a.company_id
   where a.company_id=p_company
     and s.ends_at>clock_timestamp()-interval '30 days'
     and s.starts_at<clock_timestamp()+interval '90 days'
     and (v_manager or exists(select 1 from public.company_workers w where
           w.company_id=a.company_id and w.id=a.worker_id
           and w.auth_user_id=auth.uid() and w.status='active' and w.personal_access))
   order by a.reported_at desc limit 500
 ) a;
 return result;
end $$;

create function public.review_essential_shift_absence(p_absence uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.essential_shift_absences; recipient uuid;
begin
 if auth.uid() is null or p_absence is null or
    p_decision not in ('acknowledged','follow_up') then
   raise exception using errcode='22023',message='Décision invalide';
 end if;
 select * into a from private.essential_shift_absences where id=p_absence for update;
 if not found or not private.is_manager(a.company_id) or not private.essential_feature(a.company_id,'advanced_schedules') or a.reported_by=auth.uid() then
   raise exception using errcode='42501',message='Responsable distinct requis';
 end if;
 if a.status<>'reported' then return jsonb_build_object('id',a.id,'status',a.status,'duplicate',true);end if;
 update private.essential_shift_absences set status=p_decision,reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=a.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(a.company_id,auth.uid(),'shift_absence_review',a.id,jsonb_build_object('decision',p_decision),
        'Prise en charge du signalement, sans décision de paie/congé');
 select w.auth_user_id into recipient from public.company_workers w where w.company_id=a.company_id and w.id=a.worker_id;
 if recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(a.company_id,recipient,'shift_absence','Votre signalement a été consulté',
    case when p_decision='follow_up' then 'Votre responsable vous contactera pour ce quart.'
    else 'Votre responsable a pris en charge le signalement.' end);
 end if;
 return jsonb_build_object('id',a.id,'status',p_decision,'duplicate',false);
end $$;
-- Functions are not public APIs by default: authenticated only and each rechecks tenant/role.
revoke all on function public.report_essential_shift_absence(uuid,integer,text,text,uuid) from public,anon;
revoke all on function public.list_essential_shift_absences(uuid) from public,anon;
revoke all on function public.review_essential_shift_absence(uuid,text) from public,anon;
grant execute on function public.report_essential_shift_absence(uuid,integer,text,text,uuid) to authenticated;
grant execute on function public.list_essential_shift_absences(uuid) to authenticated;
grant execute on function public.review_essential_shift_absence(uuid,text) to authenticated;
