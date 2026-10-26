-- Execute ONLY in an isolated SQL test environment with the
-- 20261026110100 migration installed. No client data persists: ROLLBACK.
begin;
do $test$
declare
 boss uuid:=gen_random_uuid();
 company uuid;
 first_order uuid;
 second_order uuid;
 lookup uuid;
 state text;
 before_preview jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@confirm-intent.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Stripe confirm intent synthetic','essential');
 first_order:=public.essential_billing_order(company,'essential_pro','monthly',50);
 perform public.billing_service_save(boss,company,first_order,
  'cus_synthetic_confirm',jsonb_build_object('status','submitting',
    'subscription_id','sub_synthetic_confirm',
    'preview',jsonb_build_object('price_id','price_synthetic_confirm')));
 select status,preview into state,before_preview
 from private.essential_billing_orders where id=first_order;
 if state<>'submitting' then raise exception 'Expected submitting before provider acceptance';end if;
 lookup:=public.billing_service_resolve_order(company,'sub_synthetic_confirm','price_synthetic_confirm',null);
 if lookup is distinct from first_order then raise exception 'In-flight webhook order not resolved';end if;
 if public.billing_service_resolve_order(company,'sub_synthetic_confirm','price_other',null) is not null then
  raise exception 'Wrong-price webhook resolved wrong order';
 end if;
 second_order:=public.essential_billing_order(company,'essential_pro','monthly',50);
 begin
  perform public.billing_service_save(boss,company,second_order,
   'cus_synthetic_confirm',jsonb_build_object('status','creating'));
  raise exception 'Expected concurrent Checkout to be rejected';
 exception when others then
  if sqlerrm='Expected concurrent Checkout to be rejected' then raise;end if;
 end;
 -- Simulate webhook winning the race with Stripe's response.
 update private.essential_billing_orders set status='paid' where id=first_order;
 perform public.billing_service_save(boss,company,first_order,
  'cus_synthetic_confirm',jsonb_build_object('status','submitted',
   'preview',jsonb_build_object('price_id','price_stale')));
 select status,preview into state,before_preview
 from private.essential_billing_orders where id=first_order;
 if state<>'paid' or before_preview->>'price_id'<>'price_synthetic_confirm' then
  raise exception 'Late provider response downgraded webhook-paid order';
 end if;
end $test$;
rollback;
