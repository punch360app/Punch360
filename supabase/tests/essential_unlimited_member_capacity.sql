-- SACATALOG-016 isolated server integration test (run as DB migration test runner).
-- Synthetic records and any auth/session settings are ROLLED BACK. NO Stripe API.
begin;
do $test$
declare
 actor uuid;invitee uuid:=gen_random_uuid();
 unlimited_company uuid:=gen_random_uuid();
 numeric_company uuid:=gen_random_uuid();
 subscription text:='sub_test_unlimited_'||replace(unlimited_company::text,'-','');
 result jsonb;worker public.company_workers;denied boolean;
begin
 select id into actor from auth.users limit 1;
 if actor is null then raise exception 'No fixture auth account exists';end if;
 insert into public.companies(id,name,created_by,product_edition,billing_status,billing_mode,is_test,seat_limit)
 values
 (unlimited_company,'SACATALOG isolated unlimited',actor,'essential','active','production',false,1),
 (numeric_company,'SACATALOG isolated numeric',actor,'essential','active','production',false,1);
 insert into public.company_members(company_id,user_id,role,status)
 values(unlimited_company,actor,'boss','active'),(numeric_company,actor,'boss','active');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if private.essential_contract_has_unlimited_members(unlimited_company) then
  raise exception 'Unlimited access granted without signed contract';end if;
 insert into private.essential_billing_accounts
 (company_id,customer_id,subscription_id,status,paid_through)
 values(unlimited_company,'cus_isolated_test',subscription,'active',now()+interval '30 days');
 if private.essential_contract_has_unlimited_members(unlimited_company) then
  raise exception 'Unlimited access granted without contract snapshot';end if;
 insert into private.essential_contracts(company_id,plan_id,plan_version,pricing_snapshot,cadence,stripe_subscription_id)
 select unlimited_company,id,version,to_jsonb(p)||jsonb_build_object('included_seats_unlimited',true),
 'monthly',subscription from public.essential_plans p where id='essential';
 if not private.essential_contract_has_unlimited_members(unlimited_company)
 then raise exception 'Paid snapshot should grant unlimited creation';end if;
 if private.essential_contract_has_unlimited_members(numeric_company)
 then raise exception 'Another company inherited entitlement';end if;
 worker:=public.create_essential_worker(unlimited_company,'SAC-2','Fixture worker');
 if worker.company_id<>unlimited_company then raise exception 'Created worker outside scope';end if;
 denied:=false;
 begin
  perform public.create_essential_worker(numeric_company,'SAC-3','Numeric blocked');
 exception when others then
  if sqlerrm not like 'Places insuffisantes%' then raise;end if; denied:=true;
 end;
 if not denied then raise exception 'Numeric company exceeded its seat limit';end if;
 result:=public.create_company_invitation(unlimited_company,'sacatalog-fixture@punch360.test.invalid','employee',1);
 if result->>'token' is null then raise exception 'Unlimited invite was not created';end if;
 insert into auth.users(id,email,email_confirmed_at)
 values(invitee,'sacatalog-fixture@punch360.test.invalid',now());
 perform set_config('request.jwt.claim.sub',invitee::text,true);
 if public.accept_company_invitation(result->>'token')<>unlimited_company
 then raise exception 'Unlimited invite acceptance crossed companies';end if;
 update private.essential_billing_accounts set paid_through=now()-interval '1 minute'
 where company_id=unlimited_company;
 if private.essential_contract_has_unlimited_members(unlimited_company)
 then raise exception 'Expired payment still grants unlimited seats';end if;
end $test$;
rollback;
