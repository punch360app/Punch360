-- NAV-007: explicit employee message about an upcoming assigned shift.
-- This does not punch in, check GPS, infer lateness or share an ETA.
create table private.essential_visit_issues(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 shift_id uuid not null references public.scheduled_shifts(id),
 worker_id uuid not null,
 kind text not null check(kind in ('late','access')),
 private_note text not null default '' check(length(private_note)<=240),
 request_id uuid not null,
 reported_by uuid not null references auth.users(id),
 reported_at timestamptz not null default clock_timestamp(),
 unique(company_id,shift_id,kind),
 unique(company_id,request_id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create index essential_visit_issues_company_time on private.essential_visit_issues(company_id,reported_at desc);
alter table private.essential_visit_issues enable row level security;
revoke all on private.essential_visit_issues from public,anon,authenticated;

create function public.report_essential_visit_issue(
 p_shift uuid,p_expected_version integer,p_kind text,p_note text,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.scheduled_shifts;v_worker public.company_workers;
 v_issue private.essential_visit_issues;
begin
 if auth.uid() is null or p_shift is null or p_request is null or p_expected_version is null
  or p_kind not in ('late','access') or p_note is null or char_length(p_note)>240 then
  raise exception using errcode='22023',message='Signalement de visite invalide';
 end if;
 select * into v_shift from public.scheduled_shifts where id=p_shift for update;
 if not found or not private.is_member(v_shift.company_id) or
   not exists(select 1 from public.companies c where c.id=v_shift.company_id and c.product_edition='essential')
 then raise exception using errcode='42501',message='Quart ou compagnie non autorisés';end if;
 select * into v_worker from public.company_workers w
 where w.company_id=v_shift.company_id and w.id=v_shift.worker_id
  and w.auth_user_id=auth.uid() and w.status='active' and w.personal_access;
 if not found then raise exception using errcode='42501',message='Ce quart ne vous est pas attribué';end if;
 select * into v_issue from private.essential_visit_issues
 where company_id=v_shift.company_id and shift_id=v_shift.id and kind=p_kind for update;
 if found then
  return jsonb_build_object('id',v_issue.id,'kind',v_issue.kind,'shift_id',v_issue.shift_id,'duplicate',true);
 end if;
 if exists(select 1 from private.essential_visit_issues
    where company_id=v_shift.company_id and request_id=p_request) then
  raise exception using errcode='23505',message='Réessai déjà utilisé sur un autre signalement';
 end if;
 if v_shift.cancelled_at is not null or v_shift.version<>p_expected_version
   or v_shift.ends_at<=clock_timestamp() or v_shift.starts_at>clock_timestamp()+interval '72 hours' then
  raise exception using errcode='22023',message='Quart expiré, annulé ou modifié; actualisez votre horaire';
 end if;
 insert into private.essential_visit_issues(company_id,shift_id,worker_id,kind,private_note,request_id,reported_by)
 values(v_shift.company_id,v_shift.id,v_worker.id,p_kind,btrim(p_note),p_request,auth.uid())
 returning * into v_issue;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(v_shift.company_id,auth.uid(),'visit_issue_reported',v_issue.id,
 jsonb_build_object('shift_id',v_shift.id,'worker_id',v_worker.id,'kind',p_kind),
 'Avis volontaire : aucun retard GPS/temps prévu ou heure de pointage déduit');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select v_shift.company_id,m.user_id,
  case when p_kind='late' then 'shift_visit_late' else 'shift_visit_access' end,
  case when p_kind='late' then 'Retard signalé par un salarié' else 'Problème d’accès signalé' end,
  'Consultez le signalement du quart dans Horaire. Aucune arrivée ou position GPS n’a été estimée.'
 from public.company_members m
 where m.company_id=v_shift.company_id and m.status='active' and m.role in ('boss','admin') and m.user_id<>auth.uid();
 return jsonb_build_object('id',v_issue.id,'kind',v_issue.kind,'shift_id',v_issue.shift_id,'duplicate',false);
end $$;

create function public.list_essential_visit_issues(
 p_company uuid,p_from timestamptz,p_to timestamptz
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_manager boolean;v_rows jsonb;v_total integer;
begin
 if auth.uid() is null or not private.is_member(p_company) or
    not exists(select 1 from public.companies where id=p_company and product_edition='essential') then
  raise exception using errcode='42501',message='Signalements non autorisés';
 end if;
 if p_from is null or p_to is null or p_from>=p_to or p_to-p_from>interval '120 days' then
  raise exception using errcode='22023',message='Période des signalements invalide';
 end if;
 v_manager:=private.is_manager(p_company);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.reported_at),'[]'::jsonb),count(*)
 into v_rows,v_total
 from(
  select vi.id,vi.company_id,vi.shift_id,vi.worker_id,vi.kind,
   vi.private_note as note,vi.reported_at,s.starts_at,s.ends_at,
   trim(w.first_name||' '||w.last_name) as worker_name
  from private.essential_visit_issues vi
  join public.scheduled_shifts s on s.id=vi.shift_id and s.company_id=vi.company_id
  join public.company_workers w on w.id=vi.worker_id and w.company_id=vi.company_id
  where vi.company_id=p_company and s.starts_at<p_to and s.ends_at>p_from
   and (v_manager or w.auth_user_id=auth.uid())
  order by s.starts_at,vi.reported_at,vi.id limit 251
 ) x;
 return jsonb_build_object(
 'items',(select coalesce(jsonb_agg(z order by (z->>'starts_at'),(z->>'reported_at')),'[]'::jsonb)
   from (select value z from jsonb_array_elements(v_rows) value limit 250) t),
 'truncated',v_total>250);
end $$;
revoke all on function public.report_essential_visit_issue(uuid,integer,text,text,uuid) from public,anon;
revoke all on function public.list_essential_visit_issues(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.report_essential_visit_issue(uuid,integer,text,text,uuid) to authenticated;
grant execute on function public.list_essential_visit_issues(uuid,timestamptz,timestamptz) to authenticated;
