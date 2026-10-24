-- Additive Essentiel foundation. Existing Construction APIs and prices are untouched.
create table public.essential_plans (
 id text primary key check(id in ('essential','essential_plus','essential_pro')),
 title text not null check(length(trim(title)) between 2 and 100),
 description text not null default '', active boolean not null default true, public_visible boolean not null default true,
 base_cents integer not null check(base_cents between 0 and 10000000),
 included_seats integer not null check(included_seats between 1 and 100000),
 extra_seat_cents integer not null check(extra_seat_cents between 0 and 10000000),
 annual_discount integer not null default 15 check(annual_discount between 0 and 100),
 kiosk_limit integer check(kiosk_limit between 1 and 100000), establishment_limit integer check(establishment_limit between 1 and 100000),
 features text[] not null, sort_order integer not null, recommended boolean not null default false,
 grace_days integer not null default 30 check(grace_days between 0 and 365),
 version integer not null default 1, updated_at timestamptz not null default now(),
 check(features @> array['punch','hours','csv','offline','personal_account','themes'])
);
alter table public.essential_plans enable row level security;
create policy essential_public_plans on public.essential_plans for select to anon using(active and public_visible);
create policy essential_authenticated_plans on public.essential_plans for select to authenticated using((active and public_visible) or public.platform_access());
grant select on public.essential_plans to anon,authenticated;
revoke insert,update,delete on public.essential_plans from anon,authenticated;
insert into public.essential_plans(id,title,base_cents,included_seats,extra_seat_cents,kiosk_limit,establishment_limit,features,sort_order,recommended)
select id,title,base,5,extra,kiosks,sites,array['punch','hours','csv','offline','personal_account','themes','kiosk','mixed_punch','paid_breaks','unpaid_breaks','schedules','leave','approvals','sms_invitations','email_invitations']||features,sort_order,recommended
from (values
 ('essential','Essentiel',1900,300,1,1,array[]::text[],1,false),
 ('essential_plus','Essentiel Plus',3900,400,3,1,array['advanced_schedules','shift_swaps','availability','departments','supervisors','announcements','messages','schedule_acknowledgements'],2,true),
 ('essential_pro','Essentiel Pro',6900,500,null::integer,null::integer,array['advanced_schedules','shift_swaps','availability','departments','supervisors','announcements','messages','schedule_acknowledgements','minimum_coverage','hr_documents','certifications','advanced_reports','time_banks','labor_costs','payroll_integrations','multiple_establishments'],3,false)
) t(id,title,base,extra,kiosks,sites,features,sort_order,recommended);
create table private.essential_plan_history (
 plan_id text not null references public.essential_plans(id),version integer not null,snapshot jsonb not null,
 actor_id uuid,reason text not null,created_at timestamptz not null default now(),primary key(plan_id,version)
);
alter table private.essential_plan_history enable row level security;
revoke all on private.essential_plan_history from public,anon,authenticated;
insert into private.essential_plan_history(plan_id,version,snapshot,reason) select id,version,to_jsonb(p),'Catalogue initial approuvé 24 octobre 2026' from public.essential_plans p;
-- Immutable commercial snapshots: only a verified billing backend may insert a contract.
create table private.essential_contracts (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 plan_id text not null references public.essential_plans(id),plan_version integer not null,
 pricing_snapshot jsonb not null,cadence text not null check(cadence in ('monthly','yearly')),
 stripe_subscription_id text unique,created_at timestamptz not null default now(),
 foreign key(plan_id,plan_version) references private.essential_plan_history(plan_id,version)
);
alter table private.essential_contracts enable row level security;
revoke all on private.essential_contracts from public,anon,authenticated;
create function private.assert_platform_mfa() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_platform_owner();
 if (select auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='Authentification à deux facteurs requise';end if;
end $$;
revoke all on function private.assert_platform_mfa() from public,anon,authenticated;
create function public.platform_save_essential_plan(p_id text,p_expected_version integer,p_values jsonb,p_reason text)
returns public.essential_plans language plpgsql security definer set search_path='' as $$
declare old public.essential_plans;result public.essential_plans;
begin
 perform private.assert_platform_mfa();
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Motif requis (3–1000 caractères)';end if;
 select * into old from public.essential_plans where id=p_id for update;
 if not found or old.version is distinct from p_expected_version then raise exception 'Version modifiée. Actualisez avant d’enregistrer.';end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or exists(select 1 from jsonb_object_keys(p_values) k where k not in ('title','description','active','public_visible','base_cents','included_seats','extra_seat_cents','annual_discount','kiosk_limit','establishment_limit','features','sort_order','recommended','grace_days')) then raise exception 'Paramètres invalides';end if;
 select * into result from jsonb_populate_record(old,p_values);
 update public.essential_plans set title=result.title,description=result.description,active=result.active,public_visible=result.public_visible,
 base_cents=result.base_cents,included_seats=result.included_seats,extra_seat_cents=result.extra_seat_cents,annual_discount=result.annual_discount,
 kiosk_limit=result.kiosk_limit,establishment_limit=result.establishment_limit,features=result.features,sort_order=result.sort_order,recommended=result.recommended,
 grace_days=result.grace_days,version=old.version+1,updated_at=clock_timestamp() where id=p_id returning * into result;
 insert into private.essential_plan_history(plan_id,version,snapshot,actor_id,reason) values(p_id,result.version,to_jsonb(result),auth.uid(),trim(p_reason));
 insert into private.platform_audit(actor_id,action,detail) values(auth.uid(),'essential_plan_updated',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(result),'reason',trim(p_reason),'existing_contracts_changed',false));
 return result;
end $$;
create function public.essential_quote(p_plan text,p_seats integer,p_cadence text default 'monthly') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare p public.essential_plans;monthly bigint;annual bigint;
begin
 if p_seats is null or p_seats not between 1 and 100000 or p_cadence is null or p_cadence not in ('monthly','yearly') then raise exception 'Devis invalide';end if;
 select * into p from public.essential_plans where id=p_plan and active and public_visible;
 if not found then raise exception 'Forfait indisponible';end if;
 monthly:=p.base_cents::bigint+greatest(0,p_seats-p.included_seats)::bigint*p.extra_seat_cents;
 annual:=round(monthly::numeric*12*(100-p.annual_discount)/100);
 return jsonb_build_object('plan_id',p.id,'version',p.version,'currency','CAD','seats',p_seats,'extra_seats',greatest(0,p_seats-p.included_seats),'monthly_cents',monthly,'annual_cents',annual,'savings_cents',monthly*12-annual,'due_cents',case when p_cadence='yearly' then annual else monthly end,'cadence',p_cadence,'tax_included',false,'payment_confirmed',false);
end $$;
revoke all on function public.platform_save_essential_plan(text,integer,jsonb,text) from public,anon;
grant execute on function public.platform_save_essential_plan(text,integer,jsonb,text) to authenticated;
revoke all on function public.essential_quote(text,integer,text) from public;
grant execute on function public.essential_quote(text,integer,text) to anon,authenticated;

-- Stable personnel records survive removal of personal authentication.
create table public.company_workers (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 auth_user_id uuid references auth.users(id) on delete set null,
 employee_number text not null check(length(trim(employee_number)) between 1 and 40),
 first_name text not null check(length(trim(first_name)) between 1 and 80),last_name text not null default '' check(length(last_name)<=80),
 email text check(email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text check(phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),sms_consent_at timestamptz,
 role text not null default 'employee' check(role in ('employee','lead','admin','boss')),
 status text not null default 'active' check(status in ('active','disabled')),
 can_mobile_punch boolean not null default true,can_kiosk_punch boolean not null default false,
 personal_access boolean not null default true,created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,employee_number),unique(company_id,auth_user_id)
);
create index workers_auth on public.company_workers(auth_user_id) where auth_user_id is not null;
alter table public.company_workers enable row level security;
create policy workers_read on public.company_workers for select to authenticated using(private.is_manager(company_id) or (auth_user_id=(select auth.uid()) and personal_access and status='active' and private.is_member(company_id)));
grant select on public.company_workers to authenticated;
revoke insert,update,delete on public.company_workers from anon,authenticated;
-- Only Essentiel is backfilled. No new Auth identity or company membership is fabricated.
insert into public.company_workers(company_id,auth_user_id,employee_number,first_name,last_name,role,status)
select m.company_id,m.user_id,'M-'||replace(m.user_id::text,'-',''),coalesce(nullif(left(ep.full_name,80),''),'Membre'),'',m.role,m.status
from public.company_members m join public.companies c on c.id=m.company_id left join public.employee_profiles ep on ep.user_id=m.user_id where c.product_edition='essential';
create function private.sync_essential_member_worker() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then
 insert into public.company_workers(company_id,auth_user_id,employee_number,first_name,role,status)
 values(new.company_id,new.user_id,'M-'||replace(new.user_id::text,'-',''),'Membre',new.role,new.status)
 on conflict(company_id,auth_user_id) do update set role=excluded.role,status=excluded.status;
 end if;return new;
end $$;
revoke all on function private.sync_essential_member_worker() from public,anon,authenticated;
create trigger essential_member_worker after insert or update of status,role on public.company_members for each row execute function private.sync_essential_member_worker();
create function public.create_essential_worker(p_company uuid,p_number text,p_first text,p_last text default '',p_email text default null,p_phone text default null,p_sms_consent boolean default false)
returns public.company_workers language plpgsql security definer set search_path='' as $$
declare result public.company_workers;c public.companies;counted integer;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire autorisé requis';end if;
 select * into c from public.companies where id=p_company for update;
 if c.product_edition<>'essential' then raise exception 'Édition Essentiel requise';end if;
 select count(*) into counted from public.company_workers where company_id=p_company and status='active';
 if counted>=c.seat_limit then raise exception 'Places insuffisantes. Ajuster l’abonnement avant de créer le salarié.';end if;
 if p_first is null or p_number is null then raise exception 'Prénom et matricule requis';end if;
 insert into public.company_workers(company_id,employee_number,first_name,last_name,email,phone,sms_consent_at)
 values(p_company,trim(p_number),trim(p_first),trim(coalesce(p_last,'')),nullif(lower(trim(p_email)),''),nullif(trim(p_phone),''),case when p_sms_consent is true and nullif(trim(p_phone),'') is not null then clock_timestamp() end) returning * into result;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'worker_created',result.id,jsonb_build_object('employee_number',result.employee_number,'has_auth_account',false),'Création du dossier salarié stable');
 return result;
end $$;
create function public.set_essential_worker_channels(p_worker uuid,p_mobile boolean,p_kiosk boolean,p_personal boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare w public.company_workers;
begin
 select * into w from public.company_workers where id=p_worker for update;
 if not found or not exists(select 1 from public.company_members where company_id=w.company_id and user_id=auth.uid() and role='boss' and status='active') or not private.can_administer(w.company_id) then raise exception using errcode='42501',message='Boss autorisé requis';end if;
 if p_mobile is null or p_kiosk is null or p_personal is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Paramètres et motif requis';end if;
 update public.company_workers set can_mobile_punch=p_mobile,can_kiosk_punch=p_kiosk,personal_access=p_personal where id=w.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(w.company_id,auth.uid(),'worker_channels',w.id,jsonb_build_object('mobile',w.can_mobile_punch,'kiosk',w.can_kiosk_punch,'personal',w.personal_access),jsonb_build_object('mobile',p_mobile,'kiosk',p_kiosk,'personal',p_personal),trim(p_reason));
end $$;
revoke all on function public.create_essential_worker(uuid,text,text,text,text,text,boolean),public.set_essential_worker_channels(uuid,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.create_essential_worker(uuid,text,text,text,text,text,boolean),public.set_essential_worker_channels(uuid,boolean,boolean,boolean,text) to authenticated;
-- Enforce mobile channel at every existing public time entry point, incl offline replay.
create or replace function private.assert_field_punch(p_company uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and status='active' and role in ('employee','lead','boss')) then
 raise exception using errcode='42501',message='Le rôle Admin est réservé à la gestion et ne peut pas puncher.';end if;
 if exists(select 1 from public.companies where id=p_company and product_edition='essential') and not exists(select 1 from public.company_workers where company_id=p_company and auth_user_id=auth.uid() and status='active' and can_mobile_punch and personal_access) then
 raise exception using errcode='42501',message='Le pointage s’effectue sur la tablette de votre entreprise.';end if;
end $$;
revoke all on function private.assert_field_punch(uuid) from public,anon,authenticated;

create function private.ensure_essential_company_workers() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.product_edition='essential' then
 insert into public.company_workers(company_id,auth_user_id,employee_number,first_name,role,status)
 select m.company_id,m.user_id,'M-'||replace(m.user_id::text,'-',''),'Membre',m.role,m.status from public.company_members m where m.company_id=new.id
 on conflict(company_id,auth_user_id) do nothing;
 end if;return new;
end $$;
revoke all on function private.ensure_essential_company_workers() from public,anon,authenticated;
create trigger ensure_essential_company_workers after update of product_edition on public.companies for each row execute function private.ensure_essential_company_workers();
