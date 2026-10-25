-- Approved commercial offers are not bills. Only an independently accepted Boss order
-- can reach the existing Stripe checkout/preview -> signed webhook pipeline.
create table private.platform_company_price_approvals(
 company_id uuid primary key references public.companies(id) on delete cascade,
 proposal_id uuid not null references private.platform_company_price_proposals(id),
 version integer not null check(version>0),
 approved_by uuid not null,
 approved_at timestamptz not null default clock_timestamp(),
 reason text not null check(length(btrim(reason)) between 8 and 1000)
);
alter table private.platform_company_price_approvals enable row level security;
revoke all on private.platform_company_price_approvals from public,anon,authenticated;

-- Existing Stripe subscription rows may be updated; preserve the old immutable
-- pricing agreement independently of the mutable "current contract" row.
create table private.essential_contract_revision_history(
 id uuid primary key default gen_random_uuid(),
 original_contract_id uuid not null,
 company_id uuid not null,
 stripe_subscription_id text,
 plan_id text not null,plan_version integer not null,
 pricing_snapshot jsonb not null,
 cadence text not null,
 original_created_at timestamptz not null,
 archived_at timestamptz not null default clock_timestamp()
);
alter table private.essential_contract_revision_history enable row level security;
revoke all on private.essential_contract_revision_history from public,anon,authenticated;
create function private.preserve_essential_contract_revision() returns trigger
 language plpgsql security definer set search_path='' as $fn$
begin
 if row(old.plan_id,old.plan_version,old.pricing_snapshot,old.cadence)
    is distinct from row(new.plan_id,new.plan_version,new.pricing_snapshot,new.cadence)
 then
  insert into private.essential_contract_revision_history
    (original_contract_id,company_id,stripe_subscription_id,plan_id,plan_version,pricing_snapshot,cadence,original_created_at)
  values(old.id,old.company_id,old.stripe_subscription_id,old.plan_id,old.plan_version,
   old.pricing_snapshot,old.cadence,old.created_at);
 end if;
 return new;
end $fn$;
revoke all on function private.preserve_essential_contract_revision() from public,anon,authenticated;
create trigger preserve_essential_contract_revision before update of plan_id,plan_version,pricing_snapshot,cadence
 on private.essential_contracts for each row execute function private.preserve_essential_contract_revision();

create function public.platform_company_price_approve(
 p_company uuid,p_proposal uuid,p_expected_approval_version integer,p_confirmation text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.companies;p private.platform_company_price_proposals;
 current_approval private.platform_company_price_approvals;result private.platform_company_price_approvals;plan public.essential_plans;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 or p_confirmation is distinct from p_company::text
 or p_expected_approval_version is null or p_expected_approval_version<0
 then raise exception using errcode='22023',message='Confirmation, version et motif obligatoires';end if;
 select * into c from public.companies where id=p_company for update;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select * into p from private.platform_company_price_proposals where id=p_proposal and company_id=p_company;
 if not found or p.status<>'draft_pending_stripe' then raise exception using errcode='22023',message='Projet de tarif introuvable';end if;
 if p.proposal_version<>(select max(proposal_version) from private.platform_company_price_proposals where company_id=p_company)
 then raise exception using errcode='40001',message='Une nouvelle proposition existe. Ouvrir le dernier devis.';end if;
 select * into plan from public.essential_plans where id=p.plan_id and active and public_visible;
 if not found or plan.version<>p.plan_version then raise exception using errcode='40001',message='Catalogue modifié, refaire le projet tarifaire';end if;
 select * into current_approval from private.platform_company_price_approvals where company_id=p_company for update;
 if coalesce(current_approval.version,0)<>p_expected_approval_version then
 raise exception using errcode='40001',message='Approbation modifiée, recharger la version';end if;
 insert into private.platform_company_price_approvals(company_id,proposal_id,version,approved_by,reason)
 values(p_company,p_proposal,coalesce(current_approval.version,0)+1,auth.uid(),btrim(p_reason))
 on conflict(company_id) do update set proposal_id=excluded.proposal_id,version=excluded.version,
 approved_by=excluded.approved_by,approved_at=clock_timestamp(),reason=excluded.reason returning * into result;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_offer_approved',p_company,
 jsonb_build_object('proposal_id',p_proposal,'previous_proposal',current_approval.proposal_id,
 'version',result.version,'reason',btrim(p_reason),'provider_confirmed',false));
 return jsonb_build_object('proposal_id',p_proposal,'company_id',p_company,
 'approval_version',result.version,'provider_confirmed',false,'effective_on',p.effective_on);
end $fn$;

create function public.platform_company_price_approval_status(p_company uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare a private.platform_company_price_approvals;c public.companies;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception using errcode='22023',message='Motif obligatoire';end if;
 select * into c from public.companies where id=p_company;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select * into a from private.platform_company_price_approvals where company_id=p_company;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_approval_read',p_company,jsonb_build_object('reason',btrim(p_reason),'version',coalesce(a.version,0)));
 return jsonb_build_object('version',coalesce(a.version,0),'proposal_id',a.proposal_id,
  'approved_at',a.approved_at,'provider_confirmed',false);
end $fn$;

create function public.essential_company_price_offer(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare c public.companies;a private.platform_company_price_approvals;p private.platform_company_price_proposals;
begin
 if auth.uid() is null or not exists(select 1 from public.company_members
    where company_id=p_company and user_id=auth.uid() and role='boss' and status='active')
 then raise exception using errcode='42501',message='Boss requis';end if;
 select * into c from public.companies where id=p_company and product_edition='essential' and not is_test;
 if not found then return null;end if;
 select * into a from private.platform_company_price_approvals where company_id=p_company;
 if not found then return null;end if;
 select * into p from private.platform_company_price_proposals where id=a.proposal_id and company_id=p_company;
 if not found then return null;end if;
 return jsonb_build_object('company_id',p_company,'proposal_id',p.id,'approval_version',a.version,
 'plan_id',p.plan_id,'title',p.snapshot->>'title','cadence',p.cadence,'seats',p.seats,'currency','CAD',
 'due_cents',p.due_cents,'monthly_cents',p.monthly_cents,'annual_cents',p.annual_cents,
 'effective_on',p.effective_on,'available',p.effective_on<=current_date,
 'payment_confirmed',false,'status','approved_not_purchased');
end $fn$;

create function public.essential_company_price_order(p_company uuid,p_approval_version integer)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare c public.companies;a private.platform_company_price_approvals;p private.platform_company_price_proposals;
 humans integer;ord uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role='boss' and status='active')
 then raise exception using errcode='42501',message='Boss requis';end if;
 select * into c from public.companies where id=p_company for update;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select * into a from private.platform_company_price_approvals where company_id=p_company for update;
 if not found or a.version is distinct from p_approval_version then raise exception using errcode='40001',message='Offre modifiée, recharger';end if;
 select * into p from private.platform_company_price_proposals where id=a.proposal_id and company_id=p_company;
 if not found or p.effective_on>current_date then raise exception using errcode='22023',message='Offre pas encore disponible';end if;
 select count(*) into humans from public.company_workers w where company_id=p_company and status='active'
  and not exists(select 1 from private.platform_owner where user_id=w.auth_user_id);
 if p.seats<humans then raise exception using errcode='22023',message='Offre insuffisante pour les salariés actifs';end if;
 if (p.snapshot->>'establishment_limit') is not null and
 (select count(*) from public.essential_locations where company_id=p_company and active)>(p.snapshot->>'establishment_limit')::integer
 then raise exception using errcode='22023',message='Limite des établissements dépassée';end if;
 if (p.snapshot->>'kiosk_limit') is not null and
 (select count(*) from private.kiosk_devices where company_id=p_company and revoked_at is null)>(p.snapshot->>'kiosk_limit')::integer
 then raise exception using errcode='22023',message='Limite des bornes dépassée';end if;
 select o.id into ord from private.essential_billing_orders o
 where o.company_id=p_company and o.actor_id=auth.uid()
  and o.snapshot->>'negotiated_price_proposal_id'=p.id::text
  and o.status in('draft','creating','previewed','checkout','submitted') and o.expires_at>clock_timestamp()
 order by o.created_at desc limit 1;
 if ord is not null then return ord;end if;
 if (select count(*) from private.essential_billing_orders where company_id=p_company and created_at>now()-interval '1 hour')>=20
 then raise exception using errcode='22023',message='Limite de devis atteinte';end if;
 insert into private.essential_billing_orders(company_id,actor_id,plan_id,plan_version,snapshot,cadence,seats,amount_cents)
 values(p_company,auth.uid(),p.plan_id,p.plan_version,
   p.snapshot||jsonb_build_object('negotiated_price_proposal_id',p.id,'negotiated_offer_version',a.version),
   p.cadence,p.seats,p.due_cents) returning id into ord;
 return ord;
end $fn$;

revoke all on function public.platform_company_price_approve(uuid,uuid,integer,text,text),
 public.platform_company_price_approval_status(uuid,text),
 public.essential_company_price_offer(uuid),public.essential_company_price_order(uuid,integer)
 from public,anon;
grant execute on function public.platform_company_price_approve(uuid,uuid,integer,text,text),
 public.platform_company_price_approval_status(uuid,text),
 public.essential_company_price_offer(uuid),public.essential_company_price_order(uuid,integer)
 to authenticated;
