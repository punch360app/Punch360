alter table public.essential_supervisors add column can_approve_time boolean not null default false;
alter table public.essential_supervisors add column can_approve_leave boolean not null default false;
alter table public.essential_supervisors add column approval_version integer not null default 1;
create function private.supervisor_scope_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not new.active then new.can_approve_time:=false;new.can_approve_leave:=false;end if;
 if row(new.can_plan,new.active,new.can_approve_time,new.can_approve_leave) is distinct from row(old.can_plan,old.active,old.can_approve_time,old.can_approve_leave) then new.approval_version:=old.approval_version+1;end if;return new;
end $$;
revoke all on function private.supervisor_scope_version() from public,anon,authenticated;
create trigger supervisor_scope_version before update on public.essential_supervisors for each row execute function private.supervisor_scope_version();
create function private.revoke_departed_supervisor() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'active' or new.role not in('employee','lead') then update public.essential_supervisors set active=false where company_id=new.company_id and user_id=new.user_id and active;end if;return new;
end $$;
revoke all on function private.revoke_departed_supervisor() from public,anon,authenticated;
create trigger departed_supervisor after update of status,role on public.company_members for each row execute function private.revoke_departed_supervisor();
create function private.essential_can_approve_worker(c uuid,w uuid,kind text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if private.can_administer(c) then return true;end if;
 if not private.is_member(c) or not exists(select 1 from public.companies where id=c and product_edition='essential' and billing_status in('setup','active','grace')) then return false;end if;
 if not private.essential_feature(c,'supervisors') then return false;end if;
 return exists(select 1 from public.company_workers worker join public.essential_supervisors g on g.company_id=worker.company_id and g.department_id=worker.department_id and g.user_id=auth.uid() and g.active where worker.company_id=c and worker.id=w and worker.status='active' and case kind when 'time' then g.can_approve_time when 'leave' then g.can_approve_leave else false end);
end $$;
revoke all on function private.essential_can_approve_worker(uuid,uuid,text) from public,anon,authenticated;
create function public.set_supervisor_approvals(p_company uuid,p_department uuid,p_user uuid,p_time boolean,p_leave boolean,p_expected_version integer,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare g public.essential_supervisors;v integer;
begin
 if not private.can_administer(p_company) or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role='boss' and status='active') or not private.essential_feature(p_company,'supervisors') then raise exception using errcode='42501',message='Boss et module superviseurs requis';end if;
 if p_time is null or p_leave is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Permissions et motif requis';end if;
 select * into g from public.essential_supervisors where company_id=p_company and department_id=p_department and user_id=p_user for update;
 if not found or not g.active or g.approval_version is distinct from p_expected_version then raise exception 'Superviseur inactif ou version modifiée : actualiser';end if;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and status='active' and role in('employee','lead')) then raise exception 'Membre superviseur invalide';end if;
 update public.essential_supervisors set can_approve_time=p_time,can_approve_leave=p_leave where company_id=p_company and department_id=p_department and user_id=p_user returning approval_version into v;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(p_company,auth.uid(),'supervisor_approval_permissions',p_department,to_jsonb(g),jsonb_build_object('user',p_user,'can_approve_time',p_time,'can_approve_leave',p_leave,'version',v),trim(p_reason));return v;
end $$;
revoke all on function public.set_supervisor_approvals(uuid,uuid,uuid,boolean,boolean,integer,text) from public,anon;
grant execute on function public.set_supervisor_approvals(uuid,uuid,uuid,boolean,boolean,integer,text) to authenticated;
