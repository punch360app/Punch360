begin;
do $test$
declare boss_id uuid:=gen_random_uuid();owner_id uuid;sid uuid:=gen_random_uuid();c uuid;
 v jsonb;draft_id uuid;order_id uuid;again_id uuid;pver integer;denied boolean;quote jsonb;
 reason text:='Test transactionnel offre commerciale approuvée';
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss_id,boss_id||'@approved-pricing.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss_id::text,true);
 c:=public.create_company_for_edition('Synthetic approved offer rollback','essential');
 update public.companies set is_test=false where id=c;
 select user_id into owner_id from private.platform_owner limit 1;
 insert into auth.sessions(id,user_id,aal,not_after)
 values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 quote:=public.platform_company_price_preview(c,'essential_plus','monthly',7,1799,5,200,15,current_date,reason);
 pver:=(quote->>'plan_version')::integer;
 v:=public.platform_company_price_draft(c,'essential_plus','monthly',7,1799,5,200,15,current_date,0,pver,c::text,reason);
 draft_id:=(v->>'id')::uuid;
 v:=public.platform_company_price_approval_status(c,reason);
 if (v->>'version')::int<>0 then raise exception 'Unexpected initial approval';end if;
 perform set_config('request.jwt.claim.sub',boss_id::text,true);
 denied:=false;begin perform public.platform_company_price_approve(c,draft_id,0,c::text,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Boss could approve commercial offer';end if;
 v:=public.essential_company_price_offer(c);
 if v is not null then raise exception 'Boss saw unapproved offer';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 denied:=false;begin perform public.platform_company_price_approve(c,draft_id,0,'wrong',reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Approval accepted incorrect company confirmation';end if;
 v:=public.platform_company_price_approve(c,draft_id,0,c::text,reason);
 if (v->>'approval_version')::int<>1 or (v->>'provider_confirmed')::boolean then raise exception 'Approval unexpected %',v;end if;
 denied:=false;begin perform public.platform_company_price_approve(c,draft_id,0,c::text,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Stale approval accepted';end if;
 perform set_config('request.jwt.claim.sub',boss_id::text,true);
 v:=public.essential_company_price_offer(c);
 if (v->>'approval_version')::int<>1 or v->>'proposal_id'<>draft_id::text or not (v->>'available')::boolean
 then raise exception 'Approved Boss offer missing %',v;end if;
 order_id:=public.essential_company_price_order(c,1);
 again_id:=public.essential_company_price_order(c,1);
 if order_id is distinct from again_id then raise exception 'Repeated offer generated duplicate checkout order';end if;
 denied:=false;begin perform public.essential_company_price_order(c,0);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Wrong approval version created an order';end if;
 execute 'reset role';
 if (select count(*) from private.essential_billing_orders where company_id=c)<>1 then raise exception 'Missing negotiated order';end if;
 if (select snapshot->>'negotiated_price_proposal_id' from private.essential_billing_orders where id=order_id)<>draft_id::text then raise exception 'Order snapshot missing immutable offer';end if;
 if (select amount_cents from private.essential_billing_orders where id=order_id)<>2199 then raise exception 'Charged amount wrong';end if;
 if exists(select 1 from private.essential_contracts where company_id=c)
 or exists(select 1 from private.essential_billing_accounts where company_id=c)
 then raise exception 'Approval/order activated subscription or contract without payment';end if;
 insert into private.essential_contracts(company_id,plan_id,plan_version,pricing_snapshot,cadence,stripe_subscription_id)
 values(c,'essential_plus',pver,'{"title":"Original","base_cents":3900}'::jsonb,'monthly','sub_approved_fixture');
 update private.essential_contracts set pricing_snapshot='{"title":"Updated","base_cents":1700}'::jsonb
 where company_id=c and stripe_subscription_id='sub_approved_fixture';
 if (select count(*) from private.essential_contract_revision_history where company_id=c)<>1
 or (select pricing_snapshot->>'title' from private.essential_contract_revision_history where company_id=c limit 1)<>'Original'
 then raise exception 'Old confirmed contract revision not preserved';end if;
end $test$;
rollback;
