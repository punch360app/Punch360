-- P0-B: represent an in-flight Stripe confirmation separately from a
-- provider-accepted change. Database migration FIRST, then Edge rollout.
-- Non-destructive: preserve all existing orders, contracts and Stripe IDs.
--
-- Retry paths and immediately arriving webhooks must resolve the new state.
create or replace function public.billing_service_resolve_order(
 p_company uuid,p_subscription text,p_price text,p_original uuid
) returns uuid
language plpgsql stable security definer set search_path='' as $function$
declare result uuid;
begin
 select id into result from private.essential_billing_orders
 where company_id=p_company
   and status in ('creating','checkout','submitting','submitted','paid')
   and (subscription_id=p_subscription or id=p_original)
   and preview->>'price_id'=p_price
 order by created_at desc limit 1;
 return result;
end $function$;

-- A webhook can mark an order paid while Stripe's POST response is still in
-- flight. Never downgrade paid -> submitted or mutate its accepted evidence.
create or replace function public.billing_service_save(
 p_actor uuid,p_company uuid,p_order uuid,p_customer text,p_values jsonb
) returns void
language plpgsql security definer set search_path='' as $function$
begin
 perform public.billing_service_context(p_actor,p_company,p_order);
 insert into private.essential_billing_accounts(company_id,customer_id)
 values(p_company,p_customer)
 on conflict(company_id) do update set
 customer_id=coalesce(private.essential_billing_accounts.customer_id,excluded.customer_id);
 if p_order is not null then
  perform 1 from public.companies where id=p_company for update;
  if p_values->>'status'='creating' and exists(
   select 1 from private.essential_billing_orders
   where company_id=p_company and id<>p_order
     and status in ('creating','checkout','submitting','submitted')
     and expires_at>now()
  ) then raise exception 'Une opération de paiement est déjà en cours';end if;
  update private.essential_billing_orders
  set status=case when status='paid' then status else coalesce(p_values->>'status',status) end,
      checkout_id=case when status='paid' then checkout_id else coalesce(p_values->>'checkout_id',checkout_id) end,
      subscription_id=case when status='paid' then subscription_id else coalesce(p_values->>'subscription_id',subscription_id) end,
      preview=case when status='paid' then preview else coalesce(p_values->'preview',preview) end
  where id=p_order and company_id=p_company;
 end if;
end $function$;

-- Keep RPC rights service-only after replacement.
revoke all on function public.billing_service_resolve_order(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.billing_service_save(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.billing_service_resolve_order(uuid,text,text,uuid) to service_role;
grant execute on function public.billing_service_save(uuid,uuid,uuid,text,jsonb) to service_role;
