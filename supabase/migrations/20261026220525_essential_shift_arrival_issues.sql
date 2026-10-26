-- NAV-007: voluntary arrival/access messages tied to a real, assigned, published shift.
-- Independent from attendance, absence, GPS, wages, client access codes, and SMS.
create table private.essential_shift_arrival_issues (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 shift_id uuid not null,
 worker_id uuid not null,
 request_id uuid not null,
 shift_version integer not null,
 kind text not null check(kind in ('late','access')),
 private_message text not null default '' check(char_length(private_message)<=500),
 estimate_minutes integer check(estimate_minutes between 1 and 240),
 status text not null default 'reported' check(status in ('reported','acknowledged')),
 reported_by uuid not null references auth.users(id),
 reported_at timestamptz not null default clock_timestamp(),
 acknowledged_by uuid references auth.users(id),
 acknowledged_at timestamptz,
 unique(company_id,shift_id,kind),
 unique(company_id,request_id),
 foreign key(company_id,shift_id) references public.scheduled_shifts(company_id,id),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 check ((kind='late') or estimate_minutes is null)
);
create index essential_arrival_issue_company_recent on private.essential_shift_arrival_issues(company_id,reported_at desc);
alter table private.essential_shift_arrival_issues enable row level security;
revoke all on private.essential_shift_arrival_issues from public,anon,authenticated;

create function public.report_essential_shift_arrival_issue(
 p_shift uuid,p_expected_version integer,p_kind text,p_message text,
 p_estimate_minutes integer,p_request uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare sh public.scheduled_shifts;worker public.company_workers;
 existing private.essential_shift_arrival_issues;issue private.essential_shift_arrival_issues;
begin
 if auth.uid() is null or p_shift is null or p_request is null or
  p_kind not in ('late','access') or p_kind is null or p_message is null or
  char_length(p_message)>500 or
  (p_kind='access' and p_estimate_minutes is not null) or
  (p_estimate_minutes is not null and p_estimate_minutes not between 1 and 240)
 then raise exception using errcode='22023',message='Information de signalement invalide';end if;
 select * into sh from public.scheduled_shifts where id=p_shift for update;
 if not found or not private.is_member(sh.company_id) or
    not exists(select 1 from public.companies c where c.id=sh.company_id and c.product_edition='essential')
 then raise exception using errcode='42501',message='Quart non autorisé';end if;
 select * into worker from public.company_workers
 where company_id=sh.company_id and id=sh.worker_id and auth_user_id=auth.uid()
  and status='active' and personal_access;
 if not found then raise exception using errcode='42501',message='Quart personnel requis';end if;
 select * into existing from private.essential_shift_arrival_issues
  where company_id=sh.company_id and shift_id=sh.id and kind=p_kind for update;
 if found then return jsonb_build_object('id',existing.id,'status',existing.status,'duplicate',true);end if;
 if exists(select 1 from private.essential_shift_arrival_issues
  where company_id=sh.company_id and request_id=p_request)
 then raise exception using errcode='23505',message='Identifiant de demande utilisé pour un autre signalement';end if;
 if sh.cancelled_at is not null or sh.worker_id is distinct from worker.id or
    sh.version is distinct from p_expected_version or
    sh.ends_at < clock_timestamp()-interval '12 hours' or
    sh.starts_at>clock_timestamp()+interval '90 days'
 then raise exception using errcode='22023',message='Quart annulé, modifié ou en dehors de la période autorisée';end if;
 insert into private.essential_shift_arrival_issues
 (company_id,shift_id,worker_id,request_id,shift_version,kind,private_message,estimate_minutes,reported_by)
 values(sh.company_id,sh.id,worker.id,p_request,sh.version,p_kind,btrim(p_message),
  p_estimate_minutes,auth.uid()) returning * into issue;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(sh.company_id,auth.uid(),'shift_arrival_issue_reported',issue.id,
 jsonb_build_object('shift_id',sh.id,'worker_id',worker.id,'kind',p_kind),
 'Communication volontaire; aucune localisation, preuve de retard ou modification du pointage');
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select sh.company_id,m.user_id,'shift_arrival_issue',
 case when p_kind='late' then 'Retard déclaré volontairement' else 'Problème d’accès signalé' end,
 'Consultez le signalement privé du quart dans Horaire.'
 from public.company_members m
 where m.company_id=sh.company_id and m.status='active'
   and m.role in ('boss','admin') and m.user_id<>auth.uid();
 return jsonb_build_object('id',issue.id,'status',issue.status,'duplicate',false);
end $$;

create function public.list_essential_shift_arrival_issues(p_company uuid)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare entries jsonb;v_manager boolean;
begin
 if p_company is null or auth.uid() is null or not private.is_member(p_company) or
 not exists(select 1 from public.companies where id=p_company and product_edition='essential')
 then raise exception using errcode='42501',message='Signalements privés de la compagnie';end if;
 v_manager:=private.is_manager(p_company);
 select coalesce(jsonb_agg(to_jsonb(t) order by t.reported_at desc,t.id),'[]'::jsonb)
 into entries
 from (
  select i.id,i.shift_id,i.worker_id,i.kind,i.private_message,i.estimate_minutes,
   i.status,i.reported_at,i.acknowledged_at,i.reported_by
  from private.essential_shift_arrival_issues i
  where i.company_id=p_company
    and (v_manager or i.reported_by=auth.uid())
  order by i.reported_at desc,i.id limit 501
 ) t;
 return jsonb_build_object('items',(
  select coalesce(jsonb_agg(value order by (value->>'reported_at') desc,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(entries) limit 500) limited
 ),'has_more',jsonb_array_length(entries)>500);
end $$;

create function public.ack_essential_shift_arrival_issue(p_company uuid,p_issue uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare issue private.essential_shift_arrival_issues;worker public.company_workers;
begin
 if p_company is null or p_issue is null or not private.is_manager(p_company)
 then raise exception using errcode='42501',message='Prise en charge réservée au responsable';end if;
 select * into issue from private.essential_shift_arrival_issues
 where company_id=p_company and id=p_issue for update;
 if not found then raise exception using errcode='42501',message='Signalement absent de cette compagnie';end if;
 if issue.status='acknowledged' then
  return jsonb_build_object('id',issue.id,'status','acknowledged','duplicate',true);
 end if;
 update private.essential_shift_arrival_issues
 set status='acknowledged',acknowledged_by=auth.uid(),acknowledged_at=clock_timestamp()
 where id=issue.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'shift_arrival_issue_acknowledged',p_issue,
 jsonb_build_object('shift_id',issue.shift_id,'kind',issue.kind,'status','acknowledged'),
 'Le responsable a consulté le signalement; aucune correction d’heures automatique');
 select * into worker from public.company_workers
 where company_id=p_company and id=issue.worker_id;
 if worker.auth_user_id is not null and worker.auth_user_id<>auth.uid()
  and worker.personal_access and worker.status='active'
  and exists(select 1 from public.company_members m where m.company_id=p_company
   and m.user_id=worker.auth_user_id and m.status='active')
 then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,worker.auth_user_id,'shift_arrival_ack',
   'Votre signalement a été pris en charge',
   'Votre responsable a pris connaissance du signalement dans Horaire.');
 end if;
 return jsonb_build_object('id',issue.id,'status','acknowledged','duplicate',false);
end $$;

revoke all on function public.report_essential_shift_arrival_issue(uuid,integer,text,text,integer,uuid) from public,anon;
revoke all on function public.list_essential_shift_arrival_issues(uuid) from public,anon;
revoke all on function public.ack_essential_shift_arrival_issue(uuid,uuid) from public,anon;
grant execute on function public.report_essential_shift_arrival_issue(uuid,integer,text,text,integer,uuid) to authenticated;
grant execute on function public.list_essential_shift_arrival_issues(uuid) to authenticated;
grant execute on function public.ack_essential_shift_arrival_issue(uuid,uuid) to authenticated;
