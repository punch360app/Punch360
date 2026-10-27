-- SACATALOG-016 (public catalogue): explicit unlimited-included flag.
-- Safe default OFF: the owner's 20/25/50 active catalogue and all historical
-- contracts/Stripe Price IDs remain unchanged. No contract is rewritten here.
alter table public.essential_plans
  add column if not exists included_seats_unlimited boolean not null default false;

-- The Super Admin is the ONLY writer. Keep MFA, compare-and-swap plan version,
-- strict payload keys, full audit and immutable plan snapshots.
create or replace function public.platform_save_essential_plan(
 p_id text,p_expected_version integer,p_values jsonb,p_reason text
) returns public.essential_plans language plpgsql security definer set search_path='' as $fn$
declare old public.essential_plans;result public.essential_plans;
begin
 perform private.assert_platform_mfa();
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000
 then raise exception 'Motif requis (3–1000 caractères)';end if;
 select * into old from public.essential_plans where id=p_id for update;
 if not found or old.version is distinct from p_expected_version
 then raise exception 'Version modifiée. Actualisez avant d’enregistrer.';end if;
 if p_values is null or jsonb_typeof(p_values)<>'object'
 or exists(select 1 from jsonb_object_keys(p_values) k where k not in
  ('title','description','active','public_visible','base_cents','included_seats',
   'included_seats_unlimited','extra_seat_cents','annual_discount','kiosk_limit',
   'establishment_limit','features','sort_order','recommended','grace_days'))
 or (p_values ? 'included_seats_unlimited'
     and jsonb_typeof(p_values->'included_seats_unlimited')<>'boolean')
 then raise exception 'Paramètres invalides';end if;
 select * into result from jsonb_populate_record(old,p_values);
 update public.essential_plans set
  title=result.title,description=result.description,active=result.active,
  public_visible=result.public_visible,base_cents=result.base_cents,
  included_seats=result.included_seats,included_seats_unlimited=result.included_seats_unlimited,
  extra_seat_cents=result.extra_seat_cents,annual_discount=result.annual_discount,
  kiosk_limit=result.kiosk_limit,establishment_limit=result.establishment_limit,
  features=result.features,sort_order=result.sort_order,recommended=result.recommended,
  grace_days=result.grace_days,version=old.version+1,updated_at=clock_timestamp()
 where id=p_id returning * into result;
 insert into private.essential_plan_history(plan_id,version,snapshot,actor_id,reason)
 values(p_id,result.version,to_jsonb(result),auth.uid(),trim(p_reason));
 insert into private.platform_audit(actor_id,action,detail)
 values(auth.uid(),'essential_plan_updated',jsonb_build_object(
  'before',to_jsonb(old),'after',to_jsonb(result),'reason',trim(p_reason),
  'existing_contracts_changed',false));
 return result;
end $fn$;
revoke all on function public.platform_save_essential_plan(text,integer,jsonb,text) from public,anon;
grant execute on function public.platform_save_essential_plan(text,integer,jsonb,text) to authenticated;

-- Quote on the PUBLIC active version only. Unlimited is a boolean, never 999999
-- or a null/absent value interpreted as unlimited. The seat count is retained.
create or replace function public.essential_quote(
 p_plan text,p_seats integer,p_cadence text default 'monthly'
) returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare p public.essential_plans;monthly bigint;annual bigint;extras integer;
begin
 if p_seats is null or p_seats not between 1 and 100000 or
    p_cadence is null or p_cadence not in ('monthly','yearly')
 then raise exception 'Devis invalide';end if;
 select * into p from public.essential_plans
 where id=p_plan and active and public_visible;
 if not found then raise exception 'Forfait indisponible';end if;
 extras:=case when p.included_seats_unlimited then 0 else greatest(0,p_seats-p.included_seats) end;
 monthly:=p.base_cents::bigint+extras::bigint*p.extra_seat_cents::bigint;
 annual:=round(monthly::numeric*12*(100-p.annual_discount)/100);
 return jsonb_build_object(
  'plan_id',p.id,'version',p.version,'currency','CAD','seats',p_seats,
  'included_seats_unlimited',p.included_seats_unlimited,'extra_seats',extras,
  'monthly_cents',monthly,'annual_cents',annual,'savings_cents',monthly*12-annual,
  'due_cents',case when p_cadence='yearly' then annual else monthly end,
  'cadence',p_cadence,'tax_included',false,'payment_confirmed',false);
end $fn$;
revoke all on function public.essential_quote(text,integer,text) from public;
grant execute on function public.essential_quote(text,integer,text) to anon,authenticated;

-- An order must honour its OWN historical contract snapshot. An absent flag
-- means the legacy numeric inclusion, not unlimited. No actual Stripe mutation
-- occurs in this function; the signed webhook remains contract authority.
create or replace function public.essential_billing_order(
 p_company uuid,p_plan text,p_cadence text,p_seats integer
) returns uuid language plpgsql security definer set search_path='' as $fn$
declare p jsonb;v integer;o uuid;monthly bigint;amount bigint;humans integer;extras integer;
begin
 perform public.essential_billing_summary(p_company);
 perform 1 from public.companies
  where id=p_company and product_edition='essential' and not is_test for update;
 if not found then raise exception 'Entreprise Essentiel réelle requise; aucun paiement pour les compagnies test';end if;
 if p_cadence is null or p_cadence not in ('monthly','yearly')
    or p_seats is null or p_seats not between 1 and 100000
 then raise exception 'Devis invalide';end if;
 select count(*) into humans from public.company_workers w
 where w.company_id=p_company and w.status='active'
 and not exists(select 1 from private.platform_owner where user_id=w.auth_user_id);
 if p_seats<humans then raise exception 'Places inférieures au nombre de personnes actives';end if;
 select pricing_snapshot,plan_version into p,v from private.essential_contracts
 where company_id=p_company and plan_id=p_plan order by created_at desc limit 1;
 if not found then
  select to_jsonb(x),version into p,v from public.essential_plans x
  where id=p_plan and active and public_visible;
 end if;
 if p is null then raise exception 'Forfait indisponible';end if;
 if (p->>'establishment_limit') is not null
  and (select count(*) from public.essential_locations where company_id=p_company and active)>(p->>'establishment_limit')::integer
 then raise exception 'Trop d’établissements pour ce forfait';end if;
 if (p->>'kiosk_limit') is not null
  and (select count(*) from private.kiosk_devices where company_id=p_company and revoked_at is null)>(p->>'kiosk_limit')::integer
 then raise exception 'Révoquez les bornes excédentaires avant le changement';end if;
 if (select count(*) from private.essential_billing_orders where company_id=p_company and created_at>now()-interval '1 hour')>=20
 then raise exception 'Limite de devis atteinte';end if;
 -- Only explicit JSON boolean TRUE activates unlimited. A missing legacy key
 -- preserves the old included_seats contract; string "true" is rejected.
 if p ? 'included_seats_unlimited'
    and jsonb_typeof(p->'included_seats_unlimited')<>'boolean'
 then raise exception 'Indicateur de membres illimités invalide';end if;
 extras:=case when p->'included_seats_unlimited'='true'::jsonb then 0
  else greatest(0,p_seats-(p->>'included_seats')::integer) end;
 monthly:=(p->>'base_cents')::bigint+extras::bigint*(p->>'extra_seat_cents')::bigint;
 amount:=case when p_cadence='yearly'
  then round(monthly::numeric*12*(100-(p->>'annual_discount')::integer)/100)
  else monthly end;
 insert into private.essential_billing_orders
  (company_id,actor_id,plan_id,plan_version,snapshot,cadence,seats,amount_cents)
 values(p_company,auth.uid(),p_plan,v,p,p_cadence,p_seats,amount)
 returning id into o;
 return o;
end $fn$;
revoke all on function public.essential_billing_order(uuid,text,text,integer) from public,anon;
grant execute on function public.essential_billing_order(uuid,text,text,integer) to authenticated;
