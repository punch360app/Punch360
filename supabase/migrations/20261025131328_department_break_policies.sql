-- Department rules are versioned. They never silently deduct or reclassify time.
create table public.essential_break_policies(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,department_id uuid not null,version integer not null,
 paid_mode text not null check(paid_mode in('choice','paid','unpaid')),suggested_minutes integer check(suggested_minutes between 1 and 240),after_work_minutes integer check(after_work_minutes between 0 and 1440),
 effective_at timestamptz not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),reason text not null check(length(trim(reason)) between 3 and 1000),
 unique(company_id,department_id,version),foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
alter table public.essential_break_policies enable row level security;
create policy break_policy_management on public.essential_break_policies for select to authenticated using(private.is_manager(company_id));
grant select on public.essential_break_policies to authenticated;revoke insert,update,delete on public.essential_break_policies from public,anon,authenticated;
alter table public.punch_breaks add column policy_snapshot jsonb;
create function private.department_break_policy(c uuid,w uuid,t timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('id',p.id,'department_id',p.department_id,'version',p.version,'paid_mode',p.paid_mode,'suggested_minutes',p.suggested_minutes,'after_work_minutes',p.after_work_minutes,'effective_at',p.effective_at) from public.essential_break_policies p join public.company_workers worker on worker.id=w and worker.company_id=c and worker.department_id=p.department_id where p.company_id=c and p.effective_at<=t order by p.effective_at desc,p.version desc limit 1),jsonb_build_object('paid_mode','choice'))
$$;
revoke all on function private.department_break_policy(uuid,uuid,timestamptz) from public,anon,authenticated;
create function public.essential_worker_break_policy(p_company uuid,p_worker uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workers;
begin
 select * into w from public.company_workers where company_id=p_company and ((p_worker is not null and id=p_worker) or (p_worker is null and auth_user_id=auth.uid()));
 if not found or not private.is_member(p_company) or (w.auth_user_id is distinct from auth.uid() and not private.is_manager(p_company)) then raise exception using errcode='42501',message='Accès refusé';end if;
 return private.department_break_policy(p_company,w.id,clock_timestamp());
end $$;
create function public.save_department_break_policy(p_company uuid,p_department uuid,p_expected_version integer,p_mode text,p_minutes integer,p_after integer,p_reason text,p_effective timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v integer;id uuid;t timestamptz:=coalesce(p_effective,clock_timestamp());
begin
 if not private.can_administer(p_company) or not private.essential_feature(p_company,'departments') then raise exception using errcode='42501',message='Gestion des départements requise';end if;
 perform 1 from public.essential_departments where id=p_department and company_id=p_company and active for update;if not found then raise exception 'Département inaccessible';end if;
 select coalesce(max(version),0) into v from public.essential_break_policies where company_id=p_company and department_id=p_department;
 if p_expected_version is distinct from v then raise exception 'Version modifiée : actualiser les politiques';end if;
 if not isfinite(t) or t<clock_timestamp()-interval '5 seconds' or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Date future ou actuelle et motif requis';end if;
 insert into public.essential_break_policies(company_id,department_id,version,paid_mode,suggested_minutes,after_work_minutes,effective_at,created_by,reason) values(p_company,p_department,v+1,p_mode,p_minutes,p_after,t,auth.uid(),trim(p_reason)) returning essential_break_policies.id into id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'department_break_policy_version',id,jsonb_build_object('department',p_department,'version',v+1,'effective_at',t,'paid_mode',p_mode),trim(p_reason));return id;
end $$;
revoke all on function public.essential_worker_break_policy(uuid,uuid),public.save_department_break_policy(uuid,uuid,integer,text,integer,integer,text,timestamptz) from public,anon;
grant execute on function public.essential_worker_break_policy(uuid,uuid),public.save_department_break_policy(uuid,uuid,integer,text,integer,integer,text,timestamptz) to authenticated;
create function private.enforce_department_break_policy() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.punch_sessions;w public.company_workers;p jsonb;conflict boolean;override boolean;
begin
 if not exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then return new;end if;
 if TG_OP='INSERT' and new.policy_snapshot is not null and exists(select 1 from private.company_restore_context where tx=txid_current() and company_id=new.company_id and actor_id=auth.uid()) then return new;end if;
 select * into s from public.punch_sessions where id=new.session_id and company_id=new.company_id;
 select * into w from public.company_workers where id=s.worker_id and company_id=s.company_id;
 p:=private.department_break_policy(s.company_id,w.id,new.started_at);
 if TG_OP='UPDATE' and new.started_at=old.started_at and old.policy_snapshot is not null then p:=old.policy_snapshot-'overridden';end if;
 conflict:=(p->>'paid_mode'='paid' and not new.is_paid) or (p->>'paid_mode'='unpaid' and new.is_paid);
 override:=conflict and private.is_manager(s.company_id) and w.auth_user_id is distinct from auth.uid();
 if conflict and not override then raise exception 'Type de pause incompatible avec la politique du département';end if;
 new.policy_snapshot:=p||jsonb_build_object('overridden',coalesce(override,false));return new;
end $$;
revoke all on function private.enforce_department_break_policy() from public,anon,authenticated;
create trigger department_break_policy before insert or update of started_at,is_paid on public.punch_breaks for each row execute function private.enforce_department_break_policy();
