-- Preserve the six prices configured manually; older installations need the same table.
create table if not exists public.essential_stripe_prices (
 id text primary key,stripe_price_id text not null,amount_cents integer not null,currency text not null default 'cad',billing_interval text not null,active boolean not null default true,updated_at timestamptz not null default now()
);
alter table public.essential_stripe_prices enable row level security;
revoke all on public.essential_stripe_prices from public,anon,authenticated;
-- Stripe-owned state; no client may manufacture a successful subscription.
create table private.essential_billing_accounts (
 company_id uuid primary key references public.companies(id), customer_id text unique,
 subscription_id text unique, status text not null default 'setup', paid_through timestamptz,
 first_unpaid_at timestamptz, canceled boolean not null default false,
 last_event_at bigint not null default 0, updated_at timestamptz not null default now()
);
create table private.essential_billing_orders (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),actor_id uuid not null,
 plan_id text not null,plan_version integer not null,snapshot jsonb not null,cadence text not null check(cadence in ('monthly','yearly')),
 seats integer not null check(seats between 1 and 100000),amount_cents bigint not null check(amount_cents>=0),
 status text not null default 'draft',checkout_id text,subscription_id text,preview jsonb,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 foreign key(plan_id,plan_version) references private.essential_plan_history(plan_id,version)
);
create table private.essential_stripe_events (
 id text primary key,event_type text not null,created bigint not null,company_id uuid not null references public.companies(id),
 received_at timestamptz not null default now()
);
create table private.essential_stripe_invoices (
 id text primary key,company_id uuid not null references public.companies(id),status text not null,
 total_cents bigint not null,paid_cents bigint not null,currency text not null check(currency='cad'),
 period_end timestamptz,paid_at timestamptz,updated_at timestamptz not null default now()
);
alter table private.essential_billing_accounts enable row level security;
alter table private.essential_billing_orders enable row level security;
alter table private.essential_stripe_events enable row level security;
alter table private.essential_stripe_invoices enable row level security;
revoke all on private.essential_billing_accounts,private.essential_billing_orders,private.essential_stripe_events,private.essential_stripe_invoices from public,anon,authenticated;
create function private.essential_billing_state(p_company uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare a private.essential_billing_accounts;days integer;
begin
 select * into a from private.essential_billing_accounts where company_id=p_company;
 if not found then return (select billing_status from public.companies where id=p_company);end if;
 if a.paid_through>now() then return 'active';end if;
 if a.canceled then return 'cancelled';end if;
 select coalesce((pricing_snapshot->>'grace_days')::integer,30) into days from private.essential_contracts where company_id=p_company order by created_at desc limit 1;
 if a.paid_through is not null and a.first_unpaid_at is not null and now()<a.first_unpaid_at+make_interval(days=>coalesce(days,30)) then return 'grace';end if;
 return case when a.subscription_id is null then 'setup' else 'restricted' end;
end $$;
create or replace function private.can_administer(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_manager(p_company) and case when exists(select 1 from public.companies where id=p_company and product_edition='essential') then private.essential_billing_state(p_company) in ('setup','active','grace') else exists(select 1 from public.companies where id=p_company and billing_status in ('setup','active','grace')) end
$$;
create function public.essential_billing_summary(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a private.essential_billing_accounts;c private.essential_contracts;workers integer;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and status='active' and role='boss') then raise exception using errcode='42501',message='Boss requis';end if;
 select * into a from private.essential_billing_accounts where company_id=p_company;
 select * into c from private.essential_contracts where company_id=p_company order by created_at desc limit 1;
 select count(*) into workers from public.company_workers w where company_id=p_company and status='active' and not exists(select 1 from private.platform_owner where user_id=w.auth_user_id);
 return jsonb_build_object('status',private.essential_billing_state(p_company),'active_humans',workers,'seats',(select seat_limit from public.companies where id=p_company),'contract',case when c.id is not null then jsonb_build_object('plan_id',c.plan_id,'cadence',c.cadence,'snapshot',c.pricing_snapshot) else null end,'paid_through',a.paid_through,'first_unpaid_at',a.first_unpaid_at,'canceled',a.canceled,'has_subscription',a.subscription_id is not null,'test_company',(select is_test from public.companies where id=p_company));
end $$;
create function public.essential_billing_order(p_company uuid,p_plan text,p_cadence text,p_seats integer) returns uuid language plpgsql security definer set search_path='' as $$
declare p jsonb;v integer;o uuid;monthly bigint;amount bigint;humans integer;
begin
 perform public.essential_billing_summary(p_company);
 perform 1 from public.companies where id=p_company and product_edition='essential' and not is_test for update;
 if not found then raise exception 'Entreprise Essentiel réelle requise; aucun paiement pour les compagnies test';end if;
 if p_cadence is null or p_cadence not in ('monthly','yearly') or p_seats is null or p_seats not between 1 and 100000 then raise exception 'Devis invalide';end if;
 select count(*) into humans from public.company_workers w where company_id=p_company and status='active' and not exists(select 1 from private.platform_owner where user_id=w.auth_user_id);
 if p_seats<humans then raise exception 'Places inférieures au nombre de personnes actives';end if;
 -- Same plan retains negotiated/historical rates even if public catalogue changed.
 select pricing_snapshot,plan_version into p,v from private.essential_contracts where company_id=p_company and plan_id=p_plan order by created_at desc limit 1;
 if not found then select to_jsonb(x),version into p,v from public.essential_plans x where id=p_plan and active and public_visible;end if;
 if p is null then raise exception 'Forfait indisponible';end if;
 if (p->>'establishment_limit') is not null and (select count(*) from public.essential_locations where company_id=p_company and active)>(p->>'establishment_limit')::integer then raise exception 'Trop d’établissements pour ce forfait';end if;
 if (p->>'kiosk_limit') is not null and (select count(*) from private.kiosk_devices where company_id=p_company and revoked_at is null)>(p->>'kiosk_limit')::integer then raise exception 'Révoquez les bornes excédentaires avant le changement';end if;
 if (select count(*) from private.essential_billing_orders where company_id=p_company and created_at>now()-interval '1 hour')>=20 then raise exception 'Limite de devis atteinte';end if;
 monthly:=(p->>'base_cents')::bigint+greatest(0,p_seats-(p->>'included_seats')::integer)*(p->>'extra_seat_cents')::bigint;
 amount:=case when p_cadence='yearly' then round(monthly::numeric*12*(100-(p->>'annual_discount')::integer)/100) else monthly end;
 insert into private.essential_billing_orders(company_id,actor_id,plan_id,plan_version,snapshot,cadence,seats,amount_cents) values(p_company,auth.uid(),p_plan,v,p,p_cadence,p_seats,amount) returning id into o;return o;
end $$;
-- Service-only context. Explicit actor checked independently of client arguments.
create function public.billing_service_context(p_actor uuid,p_company uuid,p_order uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o private.essential_billing_orders;
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_actor and role='boss' and status='active') or not exists(select 1 from public.companies where id=p_company and product_edition='essential' and not is_test) then raise exception 'Boss Essentiel requis';end if;
 if p_order is not null then select * into o from private.essential_billing_orders where id=p_order and company_id=p_company and actor_id=p_actor and expires_at>now();if not found then raise exception 'Devis expiré';end if;end if;
 return jsonb_build_object('company',p_company,'order',case when o.id is not null then to_jsonb(o) else null end,'configured_price',(select stripe_price_id from public.essential_stripe_prices where active and amount_cents=o.amount_cents and currency='cad' and billing_interval=case when o.cadence='yearly' then 'year' else 'month' end order by updated_at desc limit 1),'account',(select to_jsonb(a) from private.essential_billing_accounts a where company_id=p_company));
end $$;
create function public.billing_service_save(p_actor uuid,p_company uuid,p_order uuid,p_customer text,p_values jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.billing_service_context(p_actor,p_company,p_order);
 insert into private.essential_billing_accounts(company_id,customer_id) values(p_company,p_customer) on conflict(company_id) do update set customer_id=coalesce(private.essential_billing_accounts.customer_id,excluded.customer_id);
 if p_order is not null then
 perform 1 from public.companies where id=p_company for update;
 if p_values->>'status'='creating' and exists(select 1 from private.essential_billing_orders where company_id=p_company and id<>p_order and status in ('creating','checkout','submitted') and expires_at>now()) then raise exception 'Une opération de paiement est déjà en cours';end if;
 update private.essential_billing_orders set status=coalesce(p_values->>'status',status),checkout_id=coalesce(p_values->>'checkout_id',checkout_id),subscription_id=coalesce(p_values->>'subscription_id',subscription_id),preview=coalesce(p_values->'preview',preview) where id=p_order;end if;
end $$;
create function public.billing_service_apply(p_event text,p_type text,p_created bigint,p_company uuid,p_order uuid,p_customer text,p_subscription text,p_state jsonb,p_invoice jsonb default null) returns void language plpgsql security definer set search_path='' as $$
declare a private.essential_billing_accounts;o private.essential_billing_orders;paid timestamptz;failed timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('billing:'||p_company::text,0));
 if not exists(select 1 from public.companies where id=p_company and product_edition='essential' and not is_test) then raise exception 'Entreprise invalide';end if;
 select * into a from private.essential_billing_accounts where company_id=p_company for update;
 if a.customer_id is distinct from p_customer then raise exception 'Client Stripe inconnu';end if;
 if a.subscription_id is not null and a.subscription_id<>p_subscription then raise exception 'Abonnement différent';end if;
 if exists(select 1 from private.essential_stripe_events where id=p_event) then return;end if;
 insert into private.essential_stripe_events(id,event_type,created,company_id) values(p_event,p_type,p_created,p_company);
 if p_invoice is not null and p_invoice->>'currency'='cad' then
 insert into private.essential_stripe_invoices(id,company_id,status,total_cents,paid_cents,currency,period_end,paid_at) values(p_invoice->>'id',p_company,p_invoice->>'status',(p_invoice->>'total')::bigint,(p_invoice->>'amount_paid')::bigint,'cad',to_timestamp((p_invoice->>'period_end')::bigint),to_timestamp((p_invoice->>'paid_at')::bigint)) on conflict(id) do update set status=excluded.status,paid_cents=greatest(private.essential_stripe_invoices.paid_cents,excluded.paid_cents),paid_at=coalesce(excluded.paid_at,private.essential_stripe_invoices.paid_at),updated_at=now();
 end if;
 if p_created<a.last_event_at then return;end if;
 paid:=to_timestamp((p_state->>'paid_through')::bigint);failed:=to_timestamp((p_state->>'first_unpaid_at')::bigint);
 update private.essential_billing_accounts set subscription_id=p_subscription,status=p_state->>'status',paid_through=greatest(paid_through,paid),first_unpaid_at=case when failed is null then null else least(coalesce(first_unpaid_at,failed),failed) end,canceled=coalesce((p_state->>'canceled')::boolean,false),last_event_at=p_created,updated_at=now() where company_id=p_company;
 -- Only a fully paid current subscription can activate prices, resources and seats.
 if p_state->>'status'='active' and paid>now() and p_order is not null then
 select * into o from private.essential_billing_orders where id=p_order and company_id=p_company;
 if not found then raise exception 'Commande inconnue';end if;
 insert into private.essential_contracts(company_id,plan_id,plan_version,pricing_snapshot,cadence,stripe_subscription_id) values(p_company,o.plan_id,o.plan_version,o.snapshot||jsonb_build_object('seats',o.seats,'amount_cents',o.amount_cents),o.cadence,p_subscription)
 on conflict(stripe_subscription_id) do update set plan_id=excluded.plan_id,plan_version=excluded.plan_version,pricing_snapshot=excluded.pricing_snapshot,cadence=excluded.cadence;
 update public.companies set seat_limit=o.seats where id=p_company;
 update private.essential_billing_orders set status='paid',subscription_id=p_subscription where id=o.id;
 end if;
 update public.companies set billing_status=private.essential_billing_state(p_company) where id=p_company;
end $$;
revoke all on function private.essential_billing_state(uuid) from public,anon,authenticated;
revoke all on function public.essential_billing_summary(uuid),public.essential_billing_order(uuid,text,text,integer) from public,anon;
grant execute on function public.essential_billing_summary(uuid),public.essential_billing_order(uuid,text,text,integer) to authenticated;
revoke all on function public.billing_service_context(uuid,uuid,uuid),public.billing_service_save(uuid,uuid,uuid,text,jsonb),public.billing_service_apply(text,text,bigint,uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.billing_service_context(uuid,uuid,uuid),public.billing_service_save(uuid,uuid,uuid,text,jsonb),public.billing_service_apply(text,text,bigint,uuid,uuid,text,text,jsonb,jsonb) to service_role;
create function public.billing_service_resolve_order(p_company uuid,p_subscription text,p_price text,p_original uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 select id into result from private.essential_billing_orders where company_id=p_company and status in ('creating','checkout','submitted','paid') and (subscription_id=p_subscription or id=p_original) and preview->>'price_id'=p_price order by created_at desc limit 1;
 return result;
end $$;
revoke all on function public.billing_service_resolve_order(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.billing_service_resolve_order(uuid,text,text,uuid) to service_role;
-- Supervisors use the same dynamic restriction; no delayed cron can extend grace.
create or replace function private.essential_can_plan(p_company uuid,p_department uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_administer(p_company) or (private.is_member(p_company) and private.essential_feature(p_company,'supervisors') and private.essential_billing_state(p_company) in ('setup','active','grace') and exists(select 1 from public.essential_supervisors where company_id=p_company and department_id=p_department and user_id=auth.uid() and active and can_plan))
$$;
revoke all on function private.essential_can_plan(uuid,uuid) from public,anon,authenticated;
grant execute on function private.essential_can_plan(uuid,uuid) to authenticated;
create function public.platform_billing_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_platform_mfa();
 return jsonb_build_object(
 'mrr_cents',coalesce((select sum(case when c.cadence='yearly' then round((c.pricing_snapshot->>'amount_cents')::numeric/12) else (c.pricing_snapshot->>'amount_cents')::numeric end) from private.essential_contracts c join private.essential_billing_accounts a on a.company_id=c.company_id and a.subscription_id=c.stripe_subscription_id where a.status='active' and a.paid_through>now()),0),
 'invoices_paid_cents',coalesce((select sum(paid_cents) from private.essential_stripe_invoices),0),
 'companies',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'status',private.essential_billing_state(c.id),'subscription_status',a.status,'paid_through',a.paid_through,'first_unpaid_at',a.first_unpaid_at,'seats',c.seat_limit,'cadence',k.cadence,'plan',k.plan_id)) from private.essential_billing_accounts a join public.companies c on c.id=a.company_id left join private.essential_contracts k on k.stripe_subscription_id=a.subscription_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(x) from (select id,event_type,company_id,received_at from private.essential_stripe_events order by received_at desc limit 100)x),'[]'::jsonb));
end $$;
revoke all on function public.platform_billing_overview() from public,anon;
grant execute on function public.platform_billing_overview() to authenticated;
