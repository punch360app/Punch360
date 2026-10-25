begin;
do $$
declare boss uuid:=gen_random_uuid();owner_id uuid;sid uuid:=gen_random_uuid();c uuid;o uuid;amount bigint;paid bigint:=extract(epoch from clock_timestamp()+interval '370 days')::bigint;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@subscription-metrics.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Subscription metric rollback fixture','essential');o:=public.essential_billing_order(c,'essential_pro','yearly',7);select amount_cents into amount from private.essential_billing_orders where id=o;
 perform public.billing_service_save(boss,c,o,'cus_fixture_'||c,jsonb_build_object('preview',jsonb_build_object('price_id','price_fixture_'||c)));
 perform public.billing_service_apply('evt_metrics_'||c,'invoice.paid',100,c,o,'cus_fixture_'||c,'sub_metrics_'||c,jsonb_build_object('status','active','paid_through',paid,'canceled',false),jsonb_build_object('id','in_metrics_'||c,'status','paid','total',amount,'amount_paid',amount,'currency','cad','period_end',paid,'paid_at',extract(epoch from now())::bigint));
 update public.companies set is_test=true where id=c;
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '5 minutes');perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);execute 'set local role authenticated';
 result:=public.platform_subscription_directory('Synthetic annual metrics',c::text,true,null,'essential_pro','yearly');if (result->'summary'->>'mrr_cents')::numeric<>round(amount::numeric/12) or (result->'summary'->>'invoices_paid_cents')::bigint<>amount or (result->'summary'->>'unpriced_active')::integer<>0 or jsonb_array_length(result->'items')<>1 then raise exception 'Annual metrics incorrect';end if;
 execute 'reset role';update private.essential_billing_accounts set canceled=true where company_id=c;execute 'set local role authenticated';result:=public.platform_subscription_directory('Synthetic canceled metrics',c::text,true);if (result->'summary'->>'mrr_cents')::numeric<>0 then raise exception 'Canceled contract counted as recurring';end if;execute 'reset role';
end $$;
rollback;
