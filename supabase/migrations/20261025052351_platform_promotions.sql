create table private.platform_promotions (
 id uuid primary key,code text not null,mode text not null check(mode in('test','live')),percent_off integer not null check(percent_off between 1 and 100),
 duration text not null check(duration in('once','repeating','forever')),duration_months integer,max_redemptions integer,expires_at timestamptz,first_transaction boolean not null default false,
 status text not null default 'draft' check(status in('draft','publishing','active','disabling','refreshing','disabled','failed')),
 version integer not null default 1,pending_action text,pending_actor uuid,coupon_id text,promotion_id text,times_redeemed integer not null default 0,last_error text,
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(mode,code),check(code ~ '^[A-Z0-9]{3,30}$'),check((duration='repeating' and duration_months is not null and duration_months between 1 and 36) or (duration<>'repeating' and duration_months is null)),
 check(max_redemptions is null or max_redemptions between 1 and 1000000)
);
alter table private.platform_promotions enable row level security;
revoke all on private.platform_promotions from public,anon,authenticated;
create index platform_promotions_page on private.platform_promotions(created_at desc,id desc);
create function public.platform_create_promotion(p_request uuid,p_values jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing private.platform_promotions;r private.platform_promotions;
begin
 perform private.assert_live_platform_session();
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 or p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Demande et motif requis';end if;
 r.id:=p_request;r.code:=upper(trim(p_values->>'code'));r.mode:=p_values->>'mode';r.percent_off:=(p_values->>'percent_off')::integer;r.duration:=p_values->>'duration';r.duration_months:=(p_values->>'duration_months')::integer;r.max_redemptions:=(p_values->>'max_redemptions')::integer;r.expires_at:=(p_values->>'expires_at')::timestamptz;r.first_transaction:=coalesce((p_values->>'first_transaction')::boolean,false);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));select * into existing from private.platform_promotions where id=p_request;
 if found then
  if existing.created_by<>auth.uid() or (existing.code,existing.mode,existing.percent_off,existing.duration,existing.duration_months,existing.max_redemptions,existing.expires_at,existing.first_transaction) is distinct from (r.code,r.mode,r.percent_off,r.duration,r.duration_months,r.max_redemptions,r.expires_at,r.first_transaction) then raise exception 'Identifiant de promotion déjà utilisé';end if;return existing.id;
 end if;
 if r.expires_at is not null and r.expires_at<=clock_timestamp() then raise exception 'Expiration future requise';end if;
 insert into private.platform_promotions(id,code,mode,percent_off,duration,duration_months,max_redemptions,expires_at,first_transaction,created_by) values(r.id,r.code,r.mode,r.percent_off,r.duration,r.duration_months,r.max_redemptions,r.expires_at,r.first_transaction,auth.uid());
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'promotion_draft_created',p_request,jsonb_build_object('code',r.code,'mode',r.mode,'reason',trim(p_reason)));
 return p_request;
end $$;
create function public.platform_list_promotions(p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_live_platform_session();
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc) from (select id,code,mode,percent_off,duration,duration_months,max_redemptions,expires_at,first_transaction,status,version,times_redeemed,last_error,created_at,updated_at from private.platform_promotions where p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)) order by created_at desc,id desc limit 50)t),'[]'::jsonb);
end $$;
create function public.platform_begin_promotion(p_id uuid,p_action text,p_expected_version integer,p_reason text,p_mode text) returns boolean language plpgsql security definer set search_path='' as $$
declare r private.platform_promotions;
begin
 perform private.assert_live_platform_session();
 if p_action is null or p_action not in('publish','disable','refresh') or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Action et motif requis';end if;
 select * into r from private.platform_promotions where id=p_id for update;if not found then raise exception 'Promotion inconnue';end if;
 if r.mode is distinct from p_mode then raise exception 'Mode Stripe incorrect';end if;
 if r.pending_action is not null then if r.pending_actor=auth.uid() and r.pending_action=p_action then return true;end if;raise exception 'Opération en cours : reprendre la même action';end if;
 if (p_action='publish' and r.status='active') or (p_action='disable' and r.status='disabled') then return false;end if;
 if p_expected_version is distinct from r.version then raise exception 'Promotion modifiée : actualiser';end if;
 if (p_action='publish' and r.status not in('draft','failed')) or (p_action='disable' and r.status not in('active','failed','draft')) or (p_action='refresh' and r.status not in('active','disabled')) then raise exception 'Transition de promotion refusée';end if;
 if p_action='publish' and r.expires_at is not null and r.expires_at<=clock_timestamp() then raise exception 'Promotion expirée';end if;
 update private.platform_promotions set pending_action=p_action,pending_actor=auth.uid(),status=case p_action when 'publish' then 'publishing' when 'disable' then 'disabling' else 'refreshing' end,version=version+1,last_error=null,updated_at=clock_timestamp() where id=p_id;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'promotion_'||p_action||'_requested',p_id,jsonb_build_object('reason',trim(p_reason),'mode',r.mode));
 return true;
end $$;
create function public.platform_promotion_context(p_actor uuid,p_id uuid,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.platform_promotions;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception using errcode='42501',message='Acteur refusé';end if;
 select * into r from private.platform_promotions where id=p_id and pending_actor=p_actor and pending_action=p_action;
 if not found then raise exception 'Opération de promotion absente';end if;
 return to_jsonb(r)||jsonb_build_object('prices',coalesce((select jsonb_agg(stripe_price_id) from public.essential_stripe_prices where active),'[]'::jsonb),'plans',(select jsonb_agg(jsonb_build_object('id',id,'title',title)) from public.essential_plans));
end $$;
create function public.platform_complete_promotion(p_actor uuid,p_id uuid,p_action text,p_provider jsonb default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare r private.platform_promotions;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception using errcode='42501',message='Acteur refusé';end if;
 select * into r from private.platform_promotions where id=p_id for update;
 if r.pending_actor is distinct from p_actor or r.pending_action is distinct from p_action then raise exception 'Opération de promotion absente';end if;
 if p_error is not null then
  if p_error !~ '^STRIPE_4[0-9]{2}_[A-Za-z0-9_]+$' or p_error ~ '^STRIPE_(408|409|429)_' then raise exception 'Erreur fournisseur non définitive';end if;
  update private.platform_promotions set status='failed',pending_action=null,pending_actor=null,last_error=left(p_error,160),version=version+1,updated_at=clock_timestamp() where id=p_id;
 else
  if p_provider is null or (p_action<>'disable' and coalesce(p_provider->>'promotion_id','') !~ '^promo_[A-Za-z0-9]+$') or (p_provider->>'mode') is distinct from r.mode then raise exception 'Confirmation Stripe requise';end if;
  update private.platform_promotions set coupon_id=coalesce(p_provider->>'coupon_id',coupon_id),promotion_id=coalesce(p_provider->>'promotion_id',promotion_id),times_redeemed=coalesce((p_provider->>'times_redeemed')::integer,times_redeemed),status=case when p_action='disable' or not coalesce((p_provider->>'active')::boolean,false) then 'disabled' else 'active' end,pending_action=null,pending_actor=null,last_error=null,version=version+1,updated_at=clock_timestamp() where id=p_id;
 end if;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'promotion_'||p_action||case when p_error is null then '_confirmed' else '_failed' end,p_id,jsonb_build_object('mode',r.mode,'provider_error',p_error));
end $$;
revoke all on function public.platform_create_promotion(uuid,jsonb,text),public.platform_list_promotions(timestamptz,uuid),public.platform_begin_promotion(uuid,text,integer,text,text) from public,anon;
grant execute on function public.platform_create_promotion(uuid,jsonb,text),public.platform_list_promotions(timestamptz,uuid),public.platform_begin_promotion(uuid,text,integer,text,text) to authenticated;
revoke all on function public.platform_promotion_context(uuid,uuid,text),public.platform_complete_promotion(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.platform_promotion_context(uuid,uuid,text),public.platform_complete_promotion(uuid,uuid,text,jsonb,text) to service_role;

create function public.platform_commercial_access() returns boolean language plpgsql security definer set search_path='' as $$ begin perform private.assert_live_platform_session();return true;end $$;
revoke all on function public.platform_commercial_access() from public,anon;grant execute on function public.platform_commercial_access() to authenticated;
