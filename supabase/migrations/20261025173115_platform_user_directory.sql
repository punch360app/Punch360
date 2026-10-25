create function public.platform_search_users(p_reason text,p_query text default '',p_company uuid default null,p_test boolean default null,p_state text default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare results jsonb;more boolean;cursor_time timestamptz;cursor_id uuid;
begin
 perform private.assert_platform_owner();
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 or length(coalesce(p_query,''))>200 or (p_state is not null and p_state not in('active','banned','deleted')) or (p_before is null)<>(p_before_id is null) then raise exception 'Motif, filtres ou curseur invalides';end if;
 with matches as(select u.id,u.email,u.created_at,u.email_confirmed_at,u.last_sign_in_at,u.banned_until,u.deleted_at,
 exists(select 1 from private.test_accounts where user_id=u.id) as is_test,exists(select 1 from private.platform_owner where user_id=u.id) as is_platform_owner,
 (select count(*) from public.company_members where user_id=u.id and status='active') as active_memberships
 from auth.users u where (coalesce(trim(p_query),'')='' or strpos(lower(coalesce(u.email,'')),lower(trim(p_query)))>0 or u.id::text=trim(p_query))
 and (p_company is null or exists(select 1 from public.company_members where user_id=u.id and company_id=p_company))
 and (p_test is null or exists(select 1 from private.test_accounts where user_id=u.id)=p_test)
 and (p_state is null or (p_state='deleted' and u.deleted_at is not null) or (p_state='banned' and u.deleted_at is null and u.banned_until>clock_timestamp()) or (p_state='active' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())))
 and (p_before is null or (u.created_at,u.id)<(p_before,p_before_id)) order by u.created_at desc,u.id desc limit 51),page as(select * from matches order by created_at desc,id desc limit 50)
 select coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'),(select count(*)>50 from matches),(select created_at from page order by created_at,id limit 1),(select id from page order by created_at,id limit 1) into results,more,cursor_time,cursor_id;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'platform_users_read',p_company,jsonb_build_object('reason',trim(p_reason),'query_length',length(coalesce(p_query,'')),'test',p_test,'state',p_state,'returned',jsonb_array_length(results),'continued',p_before is not null));
 return jsonb_build_object('items',results,'has_more',more,'before',case when more then cursor_time end,'before_id',case when more then cursor_id end);
end $$;
create function public.platform_company_detail(p_company uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.companies;result jsonb;
begin
 perform private.assert_platform_owner();
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Motif requis';end if;
 select * into c from public.companies where id=p_company;if not found then raise exception 'Entreprise introuvable';end if;
 result:=jsonb_build_object('id',c.id,'name',c.name,'edition',c.product_edition,'is_test',c.is_test,'billing_status',c.billing_status,'billing_mode',c.billing_mode,'seat_limit',c.seat_limit,'created_at',c.created_at,
 'active_members',(select count(*) from public.company_members where company_id=c.id and status='active' and user_id not in(select user_id from private.platform_owner)),
 'disabled_members',(select count(*) from public.company_members where company_id=c.id and status<>'active'),
 'active_workers',(select count(*) from public.company_workers where company_id=c.id and status='active'),
 'workers_without_account',(select count(*) from public.company_workers where company_id=c.id and status='active' and auth_user_id is null),
 'entitlement',case when c.product_edition='essential' then private.essential_entitlement(c.id) else null end,
 'subscription',(select jsonb_build_object('status',a.status,'paid_through',a.paid_through,'first_unpaid_at',a.first_unpaid_at) from private.essential_billing_accounts a where company_id=c.id),
 'contract',(select jsonb_build_object('plan',k.plan_id,'cadence',k.cadence,'pricing',k.pricing_snapshot,'created_at',k.created_at) from private.essential_contracts k join private.essential_billing_accounts a on a.company_id=k.company_id and a.subscription_id=k.stripe_subscription_id where k.company_id=c.id order by k.created_at desc limit 1));
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'platform_company_read',p_company,jsonb_build_object('reason',trim(p_reason)));
 return result;
end $$;
revoke all on function public.platform_search_users(text,text,uuid,boolean,text,timestamptz,uuid),public.platform_company_detail(uuid,text) from public,anon;
grant execute on function public.platform_search_users(text,text,uuid,boolean,text,timestamptz,uuid),public.platform_company_detail(uuid,text) to authenticated;
