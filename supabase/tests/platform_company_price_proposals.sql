begin;
do $test$
declare boss uuid:=gen_random_uuid();owner_id uuid;sid uuid:=gen_random_uuid();
 c uuid;other_company uuid;v jsonb;row_id uuid;denied boolean;
 reason text:='Essai synthétique de tarification commerciale';
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@pricing-fixture.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Synthetic negotiated price test','essential');
 other_company:=public.create_company_for_edition('Synthetic construction untouched','construction');
 update public.companies set is_test=false where id=c;
 select user_id into owner_id from private.platform_owner limit 1;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 v:=public.platform_company_price_preview(c,'essential_pro','monthly',7,1799,5,200,10,current_date+7,reason);
 if (v->>'monthly_cents')::bigint<>2199 or (v->>'annual_cents')::bigint<>23749
 or (v->>'payment_confirmed')::boolean then raise exception 'Quote calculation failed %',v;end if;
 v:=public.platform_company_price_list(c,reason);
 if jsonb_array_length(v->'items')<>0 or (v->>'version')::integer<>0 then raise exception 'Preview incorrectly persisted proposal';end if;
 denied:=false;
 begin perform public.platform_company_price_draft(c,'essential_pro','monthly',7,1799,5,200,10,current_date+7,0,'wrong',reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Missing exact confirmation accepted';end if;
 v:=public.platform_company_price_draft(c,'essential_pro','monthly',7,1799,5,200,10,current_date+7,0,c::text,reason);
 if v->>'status'<>'draft_pending_stripe' or (v->>'version')::integer<>1 then raise exception 'Draft not created';end if;
 select id into row_id from private.platform_company_price_proposals where company_id=c and proposal_version=1;
 if row_id is null then raise exception 'Missing row';end if;
 denied:=false;
 begin perform public.platform_company_price_draft(c,'essential_pro','monthly',7,1799,5,200,10,current_date+7,0,c::text,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Stale revision accepted';end if;
 v:=public.platform_company_price_draft(c,'essential_pro','yearly',8,2999,5,250,15,current_date+14,1,c::text,reason);
 if (v->>'version')::integer<>2 then raise exception 'Second version rejected';end if;
 if (select monthly_cents from private.platform_company_price_proposals where id=row_id)<>2199
 then raise exception 'Historical proposal was overwritten';end if;
 if exists(select 1 from private.essential_billing_orders where company_id=c)
 or exists(select 1 from private.essential_contracts where company_id=c)
 or exists(select 1 from private.essential_billing_accounts where company_id=c)
 then raise exception 'Draft unexpectedly created payment/order/contract';end if;
 denied:=false;
 begin perform public.platform_company_price_preview(other_company,'essential_pro','monthly',7,1799,5,200,10,current_date+7,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Construction was eligible';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;
 begin perform public.platform_company_price_list(c,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Non Super Admin had access';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 execute 'reset role';
 if (select count(*) from private.platform_audit where entity_id=c and action='company_price_proposal_created')<>2
 then raise exception 'Audit events missing';end if;
end $test$;
rollback;
