-- Commercial permissions are contract snapshots; test overrides are isolated.
create table private.essential_test_plans(company_id uuid primary key references public.companies(id),snapshot jsonb not null,updated_at timestamptz not null default now());
alter table private.essential_test_plans enable row level security;
revoke all on private.essential_test_plans from public,anon,authenticated;
create function private.essential_entitlement(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_test boolean;
begin
 select is_test and billing_mode='test_simulated' into v_test from public.companies where id=p_company and product_edition='essential';
 if not found then raise exception 'Édition Essentiel requise';end if;
 if v_test then select snapshot into v_result from private.essential_test_plans where company_id=p_company;end if;
 if v_result is null then select pricing_snapshot into v_result from private.essential_contracts where company_id=p_company and stripe_subscription_id is not null order by created_at desc limit 1;end if;
 if v_result is null then select to_jsonb(p) into v_result from public.essential_plans p where id='essential';end if;
 return v_result||jsonb_build_object('simulated',v_test);
end $$;
create function private.essential_feature(p_company uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((private.essential_entitlement(p_company)->'features') ? p_feature,false)
$$;
revoke all on function private.essential_entitlement(uuid),private.essential_feature(uuid,text) from public,anon,authenticated;
create function public.essential_entitlements(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 return private.essential_entitlement(p_company);
end $$;
create function public.platform_set_essential_test_plan(p_company uuid,p_plan text) returns void language plpgsql security definer set search_path='' as $$
declare v_plan jsonb;
begin
 perform private.assert_platform_owner();
 perform 1 from public.companies where id=p_company and is_test and billing_mode='test_simulated' and product_edition='essential' for update;
 if not found then raise exception 'Compagnie Essentiel de test obligatoire';end if;
 select to_jsonb(p) into v_plan from public.essential_plans p where id=p_plan and active;
 if not found then raise exception 'Forfait inconnu';end if;
 insert into private.essential_test_plans(company_id,snapshot) values(p_company,v_plan) on conflict(company_id) do update set snapshot=excluded.snapshot,updated_at=clock_timestamp();
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'essential_test_plan',p_company,jsonb_build_object('plan',p_plan,'real_payment',false));
end $$;

create table public.essential_locations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name)) between 2 and 100),address text not null default '',timezone text not null default 'America/Toronto',
 punch_job_id uuid not null,active boolean not null default true,created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,punch_job_id),foreign key(company_id,punch_job_id) references public.jobs(company_id,id)
);
create table public.essential_departments (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),location_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 100),active boolean not null default true,
 unique(company_id,id),unique(company_id,location_id,name),foreign key(company_id,location_id) references public.essential_locations(company_id,id)
);
alter table public.company_workers add column location_id uuid;
alter table public.company_workers add column department_id uuid;
alter table public.company_workers add foreign key(company_id,location_id) references public.essential_locations(company_id,id);
alter table public.company_workers add foreign key(company_id,department_id) references public.essential_departments(company_id,id);
create index essential_workers_department on public.company_workers(company_id,department_id,status);
insert into public.essential_locations(company_id,name,punch_job_id) select id,'Établissement principal',default_punch_job_id from public.companies where product_edition='essential' and default_punch_job_id is not null;
update public.company_workers w set location_id=l.id from public.essential_locations l where w.company_id=l.company_id;
create function private.ensure_essential_location() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.product_edition='essential' and new.default_punch_job_id is not null then
 insert into public.essential_locations(company_id,name,punch_job_id) values(new.id,'Établissement principal',new.default_punch_job_id) on conflict(company_id,punch_job_id) do nothing;
 update public.company_workers set location_id=(select id from public.essential_locations where company_id=new.id and punch_job_id=new.default_punch_job_id) where company_id=new.id and location_id is null;
 end if;return new;
end $$;
create trigger ensure_essential_location after update of product_edition,default_punch_job_id on public.companies for each row execute function private.ensure_essential_location();
create function private.default_worker_location() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.location_id is null then select l.id into new.location_id from public.essential_locations l join public.companies c on c.id=l.company_id and c.default_punch_job_id=l.punch_job_id where l.company_id=new.company_id;end if;
 return new;
end $$;
create trigger default_worker_location before insert on public.company_workers for each row execute function private.default_worker_location();
create table public.essential_supervisors (
 company_id uuid not null,department_id uuid not null,user_id uuid not null,can_plan boolean not null default false,active boolean not null default true,
 primary key(company_id,department_id,user_id),foreign key(company_id,department_id) references public.essential_departments(company_id,id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create function private.essential_can_plan(p_company uuid,p_department uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_administer(p_company) or (
 private.is_member(p_company) and private.essential_feature(p_company,'supervisors') and exists(select 1 from public.companies where id=p_company and billing_status in ('setup','active','grace')) and
 exists(select 1 from public.essential_supervisors where company_id=p_company and department_id=p_department and user_id=auth.uid() and active and can_plan))
$$;
create function private.essential_sees_worker(p_company uuid,p_worker uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member(p_company) and exists(select 1 from public.company_workers w where w.company_id=p_company and w.id=p_worker and
 ((w.auth_user_id=auth.uid() and w.personal_access and w.status='active') or private.is_manager(p_company) or
 (private.essential_feature(p_company,'supervisors') and exists(select 1 from public.essential_supervisors s where s.company_id=p_company and s.department_id=w.department_id and s.user_id=auth.uid() and s.active))))
$$;
alter table public.essential_locations enable row level security;
alter table public.essential_departments enable row level security;
alter table public.essential_supervisors enable row level security;
create policy locations_member_read on public.essential_locations for select to authenticated using(private.is_member(company_id));
create policy departments_member_read on public.essential_departments for select to authenticated using(private.is_member(company_id));
create policy supervisors_scoped_read on public.essential_supervisors for select to authenticated using(private.is_manager(company_id) or (user_id=auth.uid() and private.is_member(company_id)));
grant select on public.essential_locations,public.essential_departments,public.essential_supervisors to authenticated;
revoke insert,update,delete on public.essential_locations,public.essential_departments,public.essential_supervisors from anon,authenticated;
revoke all on function private.ensure_essential_location(),private.default_worker_location() from public,anon,authenticated;
revoke all on function private.essential_can_plan(uuid,uuid),private.essential_sees_worker(uuid,uuid) from public,anon;
grant execute on function private.essential_can_plan(uuid,uuid),private.essential_sees_worker(uuid,uuid) to authenticated;
create function public.save_essential_location(p_company uuid,p_name text,p_address text default '',p_timezone text default 'America/Toronto') returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_job uuid;v_limit integer;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 perform 1 from public.companies where id=p_company for update;
 v_limit:=(private.essential_entitlement(p_company)->>'establishment_limit')::integer;
 if v_limit is not null and (select count(*) from public.essential_locations where company_id=p_company and active)>=v_limit then raise exception 'Limite d’établissements du forfait atteinte';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuseau horaire invalide';end if;
 v_id:=gen_random_uuid();
 insert into public.jobs(company_id,number,name,address) values(p_company,'ESS-'||v_id::text,p_name,coalesce(p_address,'')) returning id into v_job;
 insert into public.essential_locations(id,company_id,name,address,timezone,punch_job_id) values(v_id,p_company,trim(p_name),coalesce(p_address,''),p_timezone,v_job);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'location_created',v_id,jsonb_build_object('name',p_name),'Nouvel établissement');
 return v_id;
end $$;
create function public.save_essential_department(p_company uuid,p_location uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if not private.essential_feature(p_company,'departments') then raise exception 'Départements : forfait Plus ou Pro requis';end if;
 if not exists(select 1 from public.essential_locations where company_id=p_company and id=p_location and active) then raise exception 'Établissement invalide';end if;
 insert into public.essential_departments(company_id,location_id,name) values(p_company,p_location,trim(p_name)) returning id into v_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'department_created',v_id,jsonb_build_object('name',p_name),'Nouveau département');return v_id;
end $$;
create function public.assign_essential_worker(p_worker uuid,p_location uuid,p_department uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare w public.company_workers;
begin
 select * into w from public.company_workers where id=p_worker;
 if not found or not private.can_administer(w.company_id) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if not exists(select 1 from public.essential_locations where company_id=w.company_id and id=p_location and active) then raise exception 'Établissement invalide';end if;
 if p_department is not null and (not private.essential_feature(w.company_id,'departments') or not exists(select 1 from public.essential_departments where company_id=w.company_id and id=p_department and location_id=p_location and active)) then raise exception 'Département invalide ou non inclus au forfait';end if;
 update public.company_workers set location_id=p_location,department_id=p_department where id=w.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(w.company_id,auth.uid(),'worker_assigned',w.id,jsonb_build_object('location',w.location_id,'department',w.department_id),jsonb_build_object('location',p_location,'department',p_department),'Affectation du salarié');
end $$;
create function public.set_essential_supervisor(p_company uuid,p_department uuid,p_user uuid,p_can_plan boolean,p_active boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_administer(p_company) or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role='boss' and status='active') then raise exception using errcode='42501',message='Boss requis';end if;
 if not private.essential_feature(p_company,'supervisors') then raise exception 'Supervision non incluse au forfait';end if;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and status='active' and role in ('employee','lead')) or p_can_plan is null or p_active is null then raise exception 'Superviseur invalide';end if;
 insert into public.essential_supervisors(company_id,department_id,user_id,can_plan,active) values(p_company,p_department,p_user,p_can_plan,p_active)
 on conflict(company_id,department_id,user_id) do update set can_plan=excluded.can_plan,active=excluded.active;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'supervisor_scope',p_department,jsonb_build_object('user',p_user,'can_plan',p_can_plan,'active',p_active),'Permissions explicites du superviseur');
end $$;
create function public.essential_team_roster(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.first_name||' '||w.last_name,'employee_number',w.employee_number,'location_id',w.location_id,'department_id',w.department_id,'status',w.status)) from public.company_workers w where company_id=p_company and private.essential_sees_worker(p_company,w.id)),'[]'::jsonb);
end $$;

-- Extend the existing schedule, rather than running a second competing calendar.
alter table public.scheduled_shifts alter column user_id drop not null;
alter table public.scheduled_shifts add column worker_id uuid;
alter table public.scheduled_shifts add column location_id uuid;
alter table public.scheduled_shifts add column department_id uuid;
alter table public.scheduled_shifts add column timezone text not null default 'America/Toronto';
alter table public.scheduled_shifts add column version integer not null default 1;
alter table public.scheduled_shifts add column recurring_batch uuid;
alter table public.scheduled_shifts add unique(company_id,id);
alter table public.scheduled_shifts add foreign key(company_id,worker_id) references public.company_workers(company_id,id);
alter table public.scheduled_shifts add foreign key(company_id,location_id) references public.essential_locations(company_id,id);
alter table public.scheduled_shifts add foreign key(company_id,department_id) references public.essential_departments(company_id,id);
update public.scheduled_shifts s set worker_id=w.id,location_id=l.id,department_id=w.department_id,timezone=l.timezone from public.company_workers w,public.essential_locations l where w.company_id=s.company_id and w.auth_user_id=s.user_id and l.company_id=s.company_id and l.punch_job_id=s.job_id;
create index shifts_stable_worker_date on public.scheduled_shifts(company_id,worker_id,starts_at) where cancelled_at is null;
create table public.essential_shift_acknowledgements(shift_id uuid not null references public.scheduled_shifts(id),user_id uuid not null references auth.users(id),version integer not null,read_at timestamptz not null default clock_timestamp(),primary key(shift_id,user_id,version));
alter table public.essential_shift_acknowledgements enable row level security;
create policy shift_ack_read on public.essential_shift_acknowledgements for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.scheduled_shifts s where s.id=shift_id and private.is_manager(s.company_id)));
grant select on public.essential_shift_acknowledgements to authenticated;
revoke insert,update,delete on public.essential_shift_acknowledgements from anon,authenticated;
create table public.essential_availability (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,worker_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,available boolean not null,note text not null default '' check(length(note)<=500),
 check(ends_at>starts_at and ends_at-starts_at<=interval '31 days'),foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create index availability_worker_date on public.essential_availability(company_id,worker_id,starts_at);
alter table public.essential_availability enable row level security;
create policy availability_scoped_read on public.essential_availability for select to authenticated using(private.essential_sees_worker(company_id,worker_id));
grant select on public.essential_availability to authenticated;
revoke insert,update,delete on public.essential_availability from anon,authenticated;
create function private.essential_schedule_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare w public.company_workers;l public.essential_locations;
begin
 if not exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then return new;end if;
 if new.location_id is not null then select * into l from public.essential_locations where company_id=new.company_id and id=new.location_id and active;
 else select * into l from public.essential_locations where company_id=new.company_id and punch_job_id=new.job_id and active;end if;
 if l.id is null then raise exception 'Établissement invalide';end if;
 new.location_id:=l.id;new.job_id:=l.punch_job_id;new.timezone:=l.timezone;
 if new.worker_id is not null then select * into w from public.company_workers where company_id=new.company_id and id=new.worker_id and (status='active' or new.cancelled_at is not null);
 elsif new.user_id is not null then select * into w from public.company_workers where company_id=new.company_id and auth_user_id=new.user_id and (status='active' or new.cancelled_at is not null);end if;
 if new.worker_id is not null or new.user_id is not null then
 if w.id is null then raise exception 'Salarié inactif ou inconnu';end if;
 new.worker_id:=w.id;new.user_id:=w.auth_user_id;
 end if;
 if new.department_id is not null and not exists(select 1 from public.essential_departments where company_id=new.company_id and id=new.department_id and location_id=l.id and active) then raise exception 'Département invalide';end if;
 if new.cancelled_at is null and w.id is not null then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||new.company_id::text||coalesce(w.auth_user_id,w.id)::text,0));
 if exists(select 1 from public.scheduled_shifts x where x.company_id=new.company_id and x.id<>new.id and x.worker_id=w.id and x.cancelled_at is null and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Conflit avec un autre quart';end if;
 if exists(select 1 from public.leave_requests where company_id=new.company_id and user_id=w.auth_user_id and status='approved' and new.starts_at<((ends_on+1)::timestamp at time zone l.timezone) and new.ends_at>(begins_on::timestamp at time zone l.timezone)) then raise exception 'Congé approuvé pendant ce quart';end if;
 if exists(select 1 from public.essential_availability where company_id=new.company_id and worker_id=w.id and not available and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Indisponibilité déclarée pendant ce quart';end if;
 end if;
 return new;
end $$;
revoke all on function private.essential_schedule_guard() from public,anon,authenticated;
create trigger essential_schedule_guard before insert or update of company_id,worker_id,user_id,location_id,department_id,starts_at,ends_at,cancelled_at on public.scheduled_shifts for each row execute function private.essential_schedule_guard();
drop policy shift_read on public.scheduled_shifts;
create policy shift_read on public.scheduled_shifts for select to authenticated using(private.is_member(company_id) and
 case when exists(select 1 from public.companies c where c.id=company_id and c.product_edition='essential') then
 private.is_manager(company_id) or (worker_id is not null and private.essential_sees_worker(company_id,worker_id)) or (worker_id is null and cancelled_at is null and private.essential_feature(company_id,'advanced_schedules'))
 else user_id=auth.uid() or private.is_manager(company_id) or private.lead_sees_job_for_worker(company_id,user_id,job_id) end);
-- Policy helper used above must be callable but reveals only a feature flag for own company.
create function private.essential_member_feature(p_company uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$select private.is_member(p_company) and private.essential_feature(p_company,p_feature)$$;
revoke all on function private.essential_member_feature(uuid,text) from public,anon;
grant execute on function private.essential_member_feature(uuid,text) to authenticated;
alter policy shift_read on public.scheduled_shifts using(private.is_member(company_id) and
 case when exists(select 1 from public.companies c where c.id=scheduled_shifts.company_id and c.product_edition='essential') then
 private.is_manager(company_id) or (worker_id is not null and private.essential_sees_worker(company_id,worker_id)) or (worker_id is null and cancelled_at is null and private.essential_member_feature(company_id,'advanced_schedules'))
 else user_id=auth.uid() or private.is_manager(company_id) or private.lead_sees_job_for_worker(company_id,user_id,job_id) end);
create function private.essential_shift_notice(p_shift uuid,p_title text) returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_shifts;
begin
 select * into s from public.scheduled_shifts where id=p_shift;
 if s.user_id is not null and not exists(select 1 from public.app_notifications where company_id=s.company_id and recipient_id=s.user_id and kind='schedule' and created_at>clock_timestamp()-interval '1 minute') then insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(s.company_id,s.user_id,'schedule',p_title,to_char(s.starts_at at time zone s.timezone,'YYYY-MM-DD HH24:MI')||' · '||s.timezone||' · version '||s.version);end if;
end $$;
create function public.save_essential_shift(p_company uuid,p_worker uuid,p_location uuid,p_department uuid,p_start timestamptz,p_end timestamptz,p_note text default '',p_shift uuid default null,p_expected_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_previous public.scheduled_shifts;v_job uuid;
begin
 if not private.essential_can_plan(p_company,p_department) then raise exception using errcode='42501',message='Planification non autorisée';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '24 hours' or length(coalesce(p_note,''))>1500 then raise exception 'Quart invalide (maximum 24 heures réelles)';end if;
 if p_worker is null and not private.essential_feature(p_company,'advanced_schedules') then raise exception 'Quarts disponibles : forfait Plus ou Pro requis';end if;
 select punch_job_id into v_job from public.essential_locations where company_id=p_company and id=p_location and active;
 if v_job is null then raise exception 'Établissement invalide';end if;
 if p_shift is null then
 insert into public.scheduled_shifts(company_id,worker_id,job_id,location_id,department_id,starts_at,ends_at,note,created_by) values(p_company,p_worker,v_job,p_location,p_department,p_start,p_end,coalesce(p_note,''),auth.uid()) returning id into v_id;
 else
 select * into v_previous from public.scheduled_shifts where company_id=p_company and id=p_shift for update;
 if not found or v_previous.cancelled_at is not null or v_previous.version is distinct from p_expected_version or not private.essential_can_plan(p_company,v_previous.department_id) then raise exception 'Version modifiée ou quart non autorisé';end if;
 update public.scheduled_shifts set worker_id=p_worker,user_id=null,location_id=p_location,department_id=p_department,starts_at=p_start,ends_at=p_end,note=coalesce(p_note,''),version=version+1 where id=p_shift returning id into v_id;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(p_company,auth.uid(),case when p_shift is null then 'shift_created' else 'shift_updated' end,v_id,to_jsonb(v_previous),jsonb_build_object('worker',p_worker,'start',p_start,'end',p_end),coalesce(nullif(p_note,''),'Planification'));
 perform private.essential_shift_notice(v_id,'Horaire publié ou modifié');return v_id;
end $$;
create function public.cancel_essential_shift(p_shift uuid,p_expected_version integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_shifts;
begin
 select * into s from public.scheduled_shifts where id=p_shift for update;
 if not found or not private.essential_can_plan(s.company_id,s.department_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 if s.version is distinct from p_expected_version or s.cancelled_at is not null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Version modifiée, quart annulé ou motif manquant';end if;
 update public.scheduled_shifts set cancelled_at=clock_timestamp(),version=version+1 where id=s.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason) values(s.company_id,auth.uid(),'shift_cancelled',s.id,to_jsonb(s),trim(p_reason));
 perform private.essential_shift_notice(s.id,'Quart annulé');
end $$;
create function public.acknowledge_essential_shift(p_shift uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare s public.scheduled_shifts;
begin
 select * into s from public.scheduled_shifts where id=p_shift;
 if not found or not private.is_member(s.company_id) or s.user_id is distinct from auth.uid() or s.version is distinct from p_version then raise exception using errcode='42501',message='Quart personnel et version courante requis';end if;
 insert into public.essential_shift_acknowledgements(shift_id,user_id,version) values(s.id,auth.uid(),s.version) on conflict do nothing;
end $$;
create function public.set_essential_availability(p_company uuid,p_start timestamptz,p_end timestamptz,p_available boolean,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare w public.company_workers;v_id uuid;
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'availability') then raise exception using errcode='42501',message='Disponibilités non autorisées';end if;
 select * into w from public.company_workers where company_id=p_company and auth_user_id=auth.uid() and status='active' and personal_access;
 if not found or p_start is null or p_end is null or p_available is null then raise exception 'Disponibilité invalide';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||p_company::text||auth.uid()::text,0));
 -- Existing published shifts are never silently deleted by a new unavailability.
 insert into public.essential_availability(company_id,worker_id,starts_at,ends_at,available,note) values(p_company,w.id,p_start,p_end,p_available,coalesce(p_note,'')) returning id into v_id;return v_id;
end $$;
create table private.essential_schedule_batches(company_id uuid not null,request_id uuid not null,configuration jsonb not null,shift_ids uuid[] not null,primary key(company_id,request_id));
alter table private.essential_schedule_batches enable row level security;
revoke all on private.essential_schedule_batches from public,anon,authenticated;
create function private.essential_local_instant(p_local timestamp,p_zone text) returns timestamptz language plpgsql stable set search_path='' as $$
declare v_t timestamptz;v_minutes integer;
begin
 if not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Fuseau horaire inconnu';end if;
 v_t:=p_local at time zone p_zone;
 if (v_t at time zone p_zone)<>p_local then raise exception 'Heure locale inexistante au changement saisonnier : %',p_local;end if;
 for v_minutes in select generate_series(-120,120,15) loop
 if v_minutes<>0 and ((v_t+make_interval(mins=>v_minutes)) at time zone p_zone)=p_local then raise exception 'Heure locale ambiguë : créer ce quart manuellement avec un décalage explicite';end if;
 end loop;return v_t;
end $$;
create function public.repeat_essential_shifts(p_company uuid,p_worker uuid,p_location uuid,p_department uuid,p_first date,p_weeks integer,p_weekdays integer[],p_start time,p_end time,p_request uuid,p_note text default '') returns uuid[] language plpgsql security definer set search_path='' as $$
declare l public.essential_locations;v_day date;v_start timestamptz;v_end timestamptz;v_id uuid;v_ids uuid[]:='{}';v_config jsonb;v_previous private.essential_schedule_batches;
begin
 if not private.essential_can_plan(p_company,p_department) or not private.essential_feature(p_company,'advanced_schedules') then raise exception using errcode='42501',message='Horaires récurrents non autorisés';end if;
 if p_request is null or p_first is null or p_weeks is null or p_weeks not between 1 and 26 or p_weekdays is null or cardinality(p_weekdays) not between 1 and 7 or exists(select 1 from unnest(p_weekdays) d where d is null or d not between 1 and 7) or p_start is null or p_end is null or p_start=p_end then raise exception 'Récurrence invalide';end if;
 select * into l from public.essential_locations where company_id=p_company and id=p_location and active;
 if not found then raise exception 'Établissement invalide';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:'||p_company::text||p_request::text,0));
 v_config:=jsonb_build_object('worker',p_worker,'location',p_location,'department',p_department,'first',p_first,'weeks',p_weeks,'days',p_weekdays,'start',p_start,'end',p_end,'note',p_note);
 select * into v_previous from private.essential_schedule_batches where company_id=p_company and request_id=p_request;
 if found then if v_previous.configuration<>v_config then raise exception 'Identifiant de récurrence déjà utilisé';end if;return v_previous.shift_ids;end if;
 for v_day in select d::date from generate_series(p_first::timestamp,(p_first+p_weeks*7-1)::timestamp,interval '1 day') d loop
 if extract(isodow from v_day)::integer=any(p_weekdays) then
 v_start:=private.essential_local_instant(v_day+p_start,l.timezone);v_end:=private.essential_local_instant((v_day+case when p_end<p_start then 1 else 0 end)+p_end,l.timezone);
 v_id:=public.save_essential_shift(p_company,p_worker,p_location,p_department,v_start,v_end,p_note);
 update public.scheduled_shifts set recurring_batch=p_request where id=v_id;
 v_ids:=array_append(v_ids,v_id);
 end if;end loop;
 insert into private.essential_schedule_batches values(p_company,p_request,v_config,v_ids);return v_ids;
end $$;
-- Only intentional client RPCs and policy helpers are executable by signed-in users.
revoke all on function private.essential_shift_notice(uuid,text),private.essential_local_instant(timestamp,text) from public,anon,authenticated;
revoke all on function public.essential_entitlements(uuid),public.platform_set_essential_test_plan(uuid,text),public.save_essential_location(uuid,text,text,text),public.save_essential_department(uuid,uuid,text),public.assign_essential_worker(uuid,uuid,uuid),public.set_essential_supervisor(uuid,uuid,uuid,boolean,boolean),public.essential_team_roster(uuid),public.save_essential_shift(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer),public.cancel_essential_shift(uuid,integer,text),public.acknowledge_essential_shift(uuid,integer),public.set_essential_availability(uuid,timestamptz,timestamptz,boolean,text),public.repeat_essential_shifts(uuid,uuid,uuid,uuid,date,integer,integer[],time,time,uuid,text) from public,anon;
grant execute on function public.essential_entitlements(uuid),public.platform_set_essential_test_plan(uuid,text),public.save_essential_location(uuid,text,text,text),public.save_essential_department(uuid,uuid,text),public.assign_essential_worker(uuid,uuid,uuid),public.set_essential_supervisor(uuid,uuid,uuid,boolean,boolean),public.essential_team_roster(uuid),public.save_essential_shift(uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer),public.cancel_essential_shift(uuid,integer,text),public.acknowledge_essential_shift(uuid,integer),public.set_essential_availability(uuid,timestamptz,timestamptz,boolean,text),public.repeat_essential_shifts(uuid,uuid,uuid,uuid,date,integer,integer[],time,time,uuid,text) to authenticated;

-- A later personal activation also inherits schedules originally created without Auth.
do $$
declare d text;
begin
 select pg_get_functiondef('public.accept_worker_invitation(text)'::regprocedure) into d;
 execute replace(d,'update public.punch_sessions set user_id=auth.uid()',E'update public.scheduled_shifts set user_id=auth.uid() where company_id=w.company_id and worker_id=w.id and user_id is null;\n update public.punch_sessions set user_id=auth.uid()');
end $$;
create function public.remove_essential_availability(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.essential_availability;
begin
 select * into a from public.essential_availability where id=p_id for update;
 if not found or not private.is_member(a.company_id) or not exists(select 1 from public.company_workers where id=a.worker_id and auth_user_id=auth.uid() and status='active' and personal_access) then raise exception using errcode='42501',message='Disponibilité personnelle requise';end if;
 delete from public.essential_availability where id=a.id;
end $$;
revoke all on function public.remove_essential_availability(uuid) from public,anon;
grant execute on function public.remove_essential_availability(uuid) to authenticated;
