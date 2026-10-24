begin;
do $$
declare boss uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();c uuid;o uuid;row_json jsonb;plan jsonb;j uuid;r jsonb;denied boolean;v integer;paid bigint:=extract(epoch from now()+interval '1 year')::bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(other_user,other_user||'@test.invalid',now());
 update public.essential_plans set base_cents=1900,included_seats=5,extra_seat_cents=300,annual_discount=15 where id='essential';
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Billing regression','essential');
 execute 'set local role authenticated';o:=public.essential_billing_order(c,'essential','yearly',7);execute 'reset role';
 select amount_cents,snapshot into v,plan from private.essential_billing_orders where id=o;if v<>25500 then raise exception 'Incorrect annual seats total: %',v;end if;
 perform public.billing_service_save(boss,c,o,'cus_fixture',jsonb_build_object('preview',jsonb_build_object('price_id','price_fixture')));
 perform public.billing_service_apply('evt_paid','invoice.paid',100,c,o,'cus_fixture','sub_fixture',jsonb_build_object('status','active','paid_through',paid,'canceled',false),jsonb_build_object('id','in_fixture','status','paid','total',25500,'amount_paid',25500,'currency','cad','period_end',paid,'paid_at',extract(epoch from now())::bigint));
 if (select seat_limit from public.companies where id=c)<>7 then raise exception 'Seats not activated';end if;
 if private.essential_billing_state(c)<>'active' then raise exception 'Not active';end if;
 -- Retry event cannot shrink paid resources or double cash accounting.
 perform public.billing_service_apply('evt_paid','invoice.paid',100,c,o,'cus_fixture','sub_fixture',jsonb_build_object('status','past_due','canceled',false));
 if (select count(*) from private.essential_stripe_invoices where company_id=c)<>1 then raise exception 'Duplicated invoice';end if;
 update public.essential_plans set base_cents=9900 where id='essential';
 execute 'set local role authenticated';o:=public.essential_billing_order(c,'essential','yearly',8);execute 'reset role';
 if (select amount_cents from private.essential_billing_orders where id=o)<>28560 then raise exception 'Existing contract repriced';end if;
 update private.essential_billing_accounts set paid_through=now()-interval '1 day',first_unpaid_at=now()-interval '1 day' where company_id=c;
 if private.essential_billing_state(c)<>'grace' then raise exception 'Grace missing';end if;
 update private.essential_billing_accounts set first_unpaid_at=now()-interval '31 days' where company_id=c;
 if private.essential_billing_state(c)<>'restricted' or private.can_administer(c) then raise exception 'Grace did not expire dynamically';end if;
 -- Pointing is not a billing management action.
 select default_punch_job_id into j from public.companies where id=c;execute 'set local role authenticated';r:=public.sync_punch_event(gen_random_uuid(),c,'in',now(),false,j,null,null,null,null);if r->>'sync_status'<>'synced' then raise exception 'Restricted employee punch rejected: %',r;end if;perform public.essential_billing_summary(c);execute 'reset role';
 update private.essential_billing_accounts set paid_through=null,first_unpaid_at=now() where company_id=c;
 if private.essential_billing_state(c)<>'restricted' then raise exception 'Unpaid first invoice got free grace';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);execute 'set local role authenticated';
 denied:=false;begin perform public.essential_billing_summary(c);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Cross tenant summary';end if;
 denied:=false;begin perform public.billing_service_apply('evt_fake','invoice.paid',200,c,o,'cus_fixture','sub_fixture','{}');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client called payment RPC';end if;
 execute 'reset role';
end $$;
rollback;
