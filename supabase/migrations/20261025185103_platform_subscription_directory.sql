create function public.platform_subscription_directory(p_reason text,p_query text default '',p_test boolean default false,p_status text default null,p_plan text default null,p_cadence text default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_platform_owner();
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 or length(coalesce(p_query,''))>200 or length(coalesce(p_status,''))>40 or length(coalesce(p_plan,''))>100 or (p_cadence is not null and p_cadence not in ('monthly','yearly')) or (p_before is null)<>(p_before_id is null) then raise exception 'Motif, filtres ou curseur invalides';end if;
 with matches as materialized (
 select c.id,c.name,c.is_test,c.created_at,c.seat_limit,private.essential_billing_state(c.id) status,a.status subscription_status,a.subscription_id is not null has_subscription,a.paid_through,a.first_unpaid_at,a.canceled,k.plan_id,k.cadence,k.pricing_snapshot,
 case when k.pricing_snapshot->>'amount_cents' ~ '^\d+$' then (k.pricing_snapshot->>'amount_cents')::numeric end amount_cents
 from private.essential_billing_accounts a join public.companies c on c.id=a.company_id and c.product_edition='essential'
 left join lateral(select plan_id,cadence,pricing_snapshot from private.essential_contracts where company_id=c.id and stripe_subscription_id=a.subscription_id order by created_at desc,id desc limit 1) k on true
 where (p_test is null or c.is_test=p_test) and (p_status is null or private.essential_billing_state(c.id)=p_status) and (p_plan is null or k.plan_id=p_plan) and (p_cadence is null or k.cadence=p_cadence) and (coalesce(trim(p_query),'')='' or strpos(lower(c.name),lower(trim(p_query)))>0 or c.id::text=trim(p_query))
 ),candidate as(select * from matches where p_before is null or (created_at,id)<(p_before,p_before_id) order by created_at desc,id desc limit 51),page as(select * from candidate order by created_at desc,id desc limit 50),recurring as(select * from matches where subscription_status='active' and paid_through>now() and not canceled),summary as(
 select count(*) count,count(*) filter(where status='restricted') restricted_count from matches
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p)-'pricing_snapshot' order by created_at desc,id desc) from page p),'[]'::jsonb),'has_more',(select count(*)>50 from candidate),'before',(select created_at from page order by created_at,id limit 1),'before_id',(select id from page order by created_at,id limit 1),
 'summary',(select to_jsonb(summary) from summary)||jsonb_build_object('known_mrr_cents',coalesce((select sum(case when cadence='yearly' then round(amount_cents/12) else amount_cents end) from recurring),0),'unpriced_active',(select count(*) from recurring where amount_cents is null or cadence not in ('monthly','yearly') or cadence is null),'mrr_cents',case when exists(select 1 from recurring where amount_cents is null or cadence is null or cadence not in ('monthly','yearly')) then null else coalesce((select sum(case when cadence='yearly' then round(amount_cents/12) else amount_cents end) from recurring),0) end,'invoices_paid_cents',coalesce((select sum(i.paid_cents) from private.essential_stripe_invoices i where i.company_id in(select id from matches)),0)),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by received_at desc,id desc) from (select id,event_type,company_id,received_at from private.essential_stripe_events where company_id in(select id from matches) order by received_at desc,id desc limit 100) e),'[]'::jsonb),'test_filter',p_test) into result;
 insert into private.platform_audit(actor_id,action,detail) values(auth.uid(),'subscription_directory_read',jsonb_build_object('reason',trim(p_reason),'query_present',length(trim(coalesce(p_query,'')))>0,'test',p_test,'status',p_status,'plan',p_plan,'cadence',p_cadence,'before',p_before,'before_id',p_before_id,'returned',jsonb_array_length(result->'items')));
 return result;
end $$;
revoke all on function public.platform_subscription_directory(text,text,boolean,text,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.platform_subscription_directory(text,text,boolean,text,text,text,timestamptz,uuid) to authenticated;
