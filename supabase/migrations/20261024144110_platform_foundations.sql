-- Platform authority is a server-owned immutable binding, never an editable email/JWT claim.
create table private.platform_owner (
 singleton boolean primary key default true check(singleton),user_id uuid not null unique references auth.users(id),bound_at timestamptz not null default now(),confirmed_email_at_binding text not null
);
alter table private.platform_owner enable row level security;
revoke all on private.platform_owner from public,anon,authenticated;
insert into private.platform_owner(user_id,confirmed_email_at_binding)
select id,email from auth.users where lower(email)='punch360app@gmail.com' and email_confirmed_at is not null;
create table private.platform_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null,entity_id uuid,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table private.platform_audit enable row level security;
revoke all on private.platform_audit from public,anon,authenticated;
create function public.platform_access() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.platform_owner p join auth.users u on u.id=p.user_id where p.user_id=auth.uid() and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()))
$$;
revoke all on function public.platform_access() from public,anon;grant execute on function public.platform_access() to authenticated;
create function private.assert_platform_owner() returns void language plpgsql security definer set search_path='' as $$
begin if not public.platform_access() then raise exception using errcode='42501',message='Accès plateforme refusé';end if;end $$;
revoke all on function private.assert_platform_owner() from public,anon,authenticated;
alter table public.companies add column is_test boolean not null default false;
alter table public.companies add column billing_mode text not null default 'production' check(billing_mode in ('production','test_simulated'));
alter table public.companies add constraint test_billing_only check(billing_mode<>'test_simulated' or is_test);
-- Clients may only edit company details, never entitlement/test classification.
revoke update on public.companies from authenticated;
grant update(name) on public.companies to authenticated;
create table public.plan_catalog (
 edition text primary key check(edition in ('essential','construction')),title text not null,
 base_cents integer not null check(base_cents between 0 and 100000000),included_seats integer not null check(included_seats between 1 and 100000),extra_seat_cents integer not null check(extra_seat_cents between 0 and 100000000),annual_discount integer not null check(annual_discount between 0 and 100),grace_days integer not null check(grace_days between 0 and 365),invitation_hours integer not null check(invitation_hours between 1 and 168),version integer not null default 1,updated_at timestamptz not null default now()
);
alter table public.plan_catalog enable row level security;
create policy published_plans on public.plan_catalog for select to anon,authenticated using(true);
grant select on public.plan_catalog to anon,authenticated;
revoke insert,update,delete on public.plan_catalog from anon,authenticated;
insert into public.plan_catalog values ('essential','PUNCH Essentiel',1900,5,300,15,30,72,1,now()),('construction','PUNCH Chantier',4900,5,700,15,30,72,1,now());
create function public.platform_update_plan(p_edition text,p_base integer,p_included integer,p_extra integer,p_discount integer,p_grace integer,p_invitation integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare old_value jsonb;new_value jsonb;
begin
 perform private.assert_platform_owner();
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Motif requis';end if;
 select to_jsonb(p) into old_value from public.plan_catalog p where edition=p_edition for update;
 if not found then raise exception 'Forfait inconnu';end if;
 update public.plan_catalog set base_cents=p_base,included_seats=p_included,extra_seat_cents=p_extra,annual_discount=p_discount,grace_days=p_grace,invitation_hours=p_invitation,version=version+1,updated_at=now() where edition=p_edition returning to_jsonb(plan_catalog) into new_value;
 insert into private.platform_audit(actor_id,action,detail) values(auth.uid(),'plan_updated',jsonb_build_object('before',old_value,'after',new_value,'reason',trim(p_reason)));
end $$;
create function public.platform_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_platform_owner();
 select jsonb_build_object('companies',(select count(*) from public.companies where not is_test),'test_companies',(select count(*) from public.companies where is_test),'users',(select count(*) from auth.users),'active_members',(select count(*) from public.company_members m join public.companies c on c.id=m.company_id where m.status='active' and not c.is_test and m.user_id not in(select user_id from private.platform_owner)),
 'essential',(select count(*) from public.companies where product_edition='essential' and not is_test),'construction',(select count(*) from public.companies where product_edition='construction' and not is_test),'stripe_connected',false,'mrr_cents',null,'arr_cents',null,
 'companies_list',coalesce((select jsonb_agg(x) from (select id,name,product_edition,is_test,billing_mode,billing_status,seat_limit,created_at from public.companies order by created_at desc limit 200)x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(x) from (select id,action,entity_id,detail,created_at from private.platform_audit order by created_at desc limit 100)x),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.platform_create_test_company(p_name text,p_edition text,p_seats integer default 10)
returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;j uuid;
begin
 perform private.assert_platform_owner();
 if p_edition not in ('essential','construction') or p_edition is null or p_seats not between 1 and 100 then raise exception 'Configuration de test invalide';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 110 then raise exception 'Nom requis (2–110 caractères)';end if;
 insert into public.companies(name,created_by,is_test,billing_mode,billing_status,seat_limit,product_edition) values('[TEST] '||trim(p_name),auth.uid(),true,'test_simulated','active',p_seats,p_edition) returning id into c;
 if p_edition='essential' then
  insert into public.jobs(company_id,number,name) values(c,'ESSENTIEL','Établissement de test') returning id into j;update public.companies set default_punch_job_id=j where id=c;
 else
  insert into public.jobs(company_id,number,name) values(c,'TEST-001','Chantier fictif 1'),(c,'TEST-002','Chantier fictif 2');
 end if;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'test_company_created',c,jsonb_build_object('edition',p_edition,'billing_mode','test_simulated'));
 return c;
end $$;
create table private.test_accounts(user_id uuid primary key references auth.users(id) on delete cascade,company_id uuid not null references public.companies(id),created_by uuid not null,created_at timestamptz not null default now());
alter table private.test_accounts enable row level security;revoke all on private.test_accounts from public,anon,authenticated;
-- Service-only registration: Edge Function validates real identity, then calls this atomic operation.
create function public.platform_register_test_user(p_actor uuid,p_user uuid,p_company uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception 'Acteur invalide';end if;
 if not exists(select 1 from public.companies where id=p_company and is_test and billing_mode='test_simulated') or p_role not in ('employee','lead','admin','boss') or p_role is null then raise exception 'Environnement de test obligatoire';end if;
 perform 1 from public.companies where id=p_company for update;
 if (select count(*) from public.company_members where company_id=p_company and status='active')>=(select seat_limit from public.companies where id=p_company) then raise exception 'Places de test épuisées';end if;
 if not exists(select 1 from auth.users where id=p_user and email like '%@punch360.test.invalid' and email_confirmed_at is not null) or exists(select 1 from public.company_members where user_id=p_user) then raise exception 'Identité test neuve obligatoire';end if;
 insert into private.test_accounts(user_id,company_id,created_by) values(p_user,p_company,p_actor);
 insert into public.company_members(company_id,user_id,role) values(p_company,p_user,p_role);
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'test_user_created',p_user,jsonb_build_object('company',p_company,'role',p_role));
end $$;
create function public.platform_test_account_status(p_actor uuid,p_user uuid,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception 'Acteur invalide';end if;
 if not exists(select 1 from private.test_accounts t join public.companies c on c.id=t.company_id where t.user_id=p_user and c.is_test and c.billing_mode='test_simulated') then raise exception 'Compte de test obligatoire';end if;
 if not p_active and exists(select 1 from public.punch_sessions where user_id=p_user and ended_at is null) then raise exception 'Terminer le punch de test avant désactivation';end if;
 update public.company_members set status=case when p_active then 'active' else 'disabled' end where user_id=p_user and company_id in(select company_id from private.test_accounts where user_id=p_user);
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'test_user_status',p_user,jsonb_build_object('active',p_active));
end $$;
create function public.platform_test_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_platform_owner();
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'company_id',t.company_id,'email',u.email,'role',m.role,'status',m.status)) from private.test_accounts t join auth.users u on u.id=t.user_id join public.company_members m on m.user_id=t.user_id and m.company_id=t.company_id),'[]'::jsonb);
end $$;
revoke all on function public.platform_update_plan(text,integer,integer,integer,integer,integer,integer,text),public.platform_snapshot(),public.platform_create_test_company(text,text,integer),public.platform_test_accounts() from public,anon;
grant execute on function public.platform_update_plan(text,integer,integer,integer,integer,integer,integer,text),public.platform_snapshot(),public.platform_create_test_company(text,text,integer),public.platform_test_accounts() to authenticated;
revoke all on function public.platform_register_test_user(uuid,uuid,uuid,text),public.platform_test_account_status(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.platform_register_test_user(uuid,uuid,uuid,text),public.platform_test_account_status(uuid,uuid,boolean) to service_role;
-- Test billing must never be used to invite production addresses.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.create_company_invitation(uuid,text,text,integer)'::regprocedure) into definition;
 execute regexp_replace(definition,'\mbegin\M',E'begin\n if exists(select 1 from public.companies where id=p_company and is_test) and lower(trim(p_email)) not like ''%@punch360.test.invalid'' then raise exception ''Invitation de test : adresse fictive réservée obligatoire'';end if;','i');
end $$;

