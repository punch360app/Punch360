-- Immutable negotiated-price proposals, no activation or Stripe mutation.
-- Only owner with living AAL2 session can preview/create/list; no public table privileges.
create table private.platform_company_price_proposals (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 proposal_version integer not null check(proposal_version>0),
 plan_id text not null,
 plan_version integer not null,
 snapshot jsonb not null,
 currency text not null default 'CAD' check(currency='CAD'),
 cadence text not null check(cadence in ('monthly','yearly')),
 seats integer not null check(seats between 1 and 100000),
 monthly_cents bigint not null check(monthly_cents between 0 and 99999999),
 annual_cents bigint not null check(annual_cents between 0 and 99999999),
 due_cents bigint not null check(due_cents between 0 and 99999999),
 effective_on date not null,
 status text not null default 'draft_pending_stripe' check(status='draft_pending_stripe'),
 reason text not null check(length(btrim(reason)) between 8 and 1000),
 actor_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(company_id,proposal_version)
);
alter table private.platform_company_price_proposals enable row level security;
revoke all on private.platform_company_price_proposals from public,anon,authenticated;

create function private.platform_company_price_calculate(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,
 p_effective_on date
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare c public.companies;plan public.essential_plans;monthly bigint;annual bigint;snapshot jsonb;occupied integer;
begin
 select * into c from public.companies where id=p_company;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select * into plan from public.essential_plans where id=p_plan and active and public_visible;
 if not found then raise exception using errcode='22023',message='Forfait indisponible';end if;
 if p_cadence not in('monthly','yearly') or p_cadence is null or p_seats not between 1 and 100000
 or p_base not between 0 and 10000000 or p_included not between 1 and 100000
 or p_extra not between 0 and 1000000 or p_discount not between 0 and 100
 or p_base is null or p_included is null or p_extra is null or p_discount is null
 or p_effective_on is null or p_effective_on<current_date or p_effective_on>current_date+365
 then raise exception using errcode='22023',message='Montants, sièges, remise ou date d’effet invalides';end if;
 select count(*) into occupied from public.company_workers w where w.company_id=p_company and w.status='active'
 and not exists(select 1 from private.platform_owner where user_id=w.auth_user_id);
 if p_seats<occupied then raise exception using errcode='22023',message='Sièges inférieurs au nombre de salariés actifs';end if;
 monthly:=p_base::bigint+greatest(0,p_seats-p_included)::bigint*p_extra::bigint;
 annual:=round(monthly::numeric*12*(100-p_discount)/100);
 if monthly>99999999 or annual>99999999 then raise exception using errcode='22023',message='Montant CAD hors limites Stripe';end if;
 snapshot:=to_jsonb(plan)||jsonb_build_object('base_cents',p_base,'included_seats',p_included,
  'extra_seat_cents',p_extra,'annual_discount',p_discount,'negotiated',true);
 return jsonb_build_object('company_id',p_company,'plan_id',p_plan,'plan_version',plan.version,
  'cadence',p_cadence,'seats',p_seats,'currency','CAD','monthly_cents',monthly,
  'annual_cents',annual,'due_cents',case when p_cadence='yearly' then annual else monthly end,
  'effective_on',p_effective_on,'snapshot',snapshot,'payment_confirmed',false,
  'status','draft_pending_stripe','scope','company_only');
end $fn$;
revoke all on function private.platform_company_price_calculate(uuid,text,text,integer,integer,integer,integer,integer,date) from public,anon,authenticated;

create function public.platform_company_price_preview(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,p_effective_on date,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare quote jsonb;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception using errcode='22023',message='Motif requis';end if;
 quote:=private.platform_company_price_calculate(p_company,p_plan,p_cadence,p_seats,p_base,p_included,p_extra,p_discount,p_effective_on);
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposal_preview',p_company,
 jsonb_build_object('reason',btrim(p_reason),'plan',p_plan,'effective_on',p_effective_on));
 return quote;
end $fn$;

create function public.platform_company_price_list(p_company uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.companies;items jsonb;version integer;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception using errcode='22023',message='Motif requis';end if;
 select * into c from public.companies where id=p_company;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select coalesce(max(proposal_version),0) into version from private.platform_company_price_proposals where company_id=p_company;
 select coalesce(jsonb_agg(z order by z.proposal_version desc),'[]'::jsonb) into items from
  (select id,proposal_version,plan_id,plan_version,cadence,seats,monthly_cents,annual_cents,due_cents,
   currency,effective_on,status,actor_id,created_at
   from private.platform_company_price_proposals where company_id=p_company order by proposal_version desc limit 20) z;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposals_read',p_company,jsonb_build_object('reason',btrim(p_reason),'returned',jsonb_array_length(items)));
 return jsonb_build_object('company_id',p_company,'version',version,'items',items,'stripe_confirmed',false);
end $fn$;

create function public.platform_company_price_draft(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,
 p_effective_on date,p_expected_version integer,p_confirmation text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.companies;quote jsonb;last_version integer;newrow private.platform_company_price_proposals;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 or p_confirmation is distinct from p_company::text
 or p_expected_version is null or p_expected_version<0
 then raise exception using errcode='22023',message='Confirmer identifiant exact, version et motif';end if;
 select * into c from public.companies where id=p_company for update;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select coalesce(max(proposal_version),0) into last_version from private.platform_company_price_proposals where company_id=p_company;
 if last_version<>p_expected_version then raise exception using errcode='40001',message='Proposition modifiée, recharger avant enregistrement';end if;
 quote:=private.platform_company_price_calculate(p_company,p_plan,p_cadence,p_seats,p_base,p_included,p_extra,p_discount,p_effective_on);
 if (select count(*) from private.platform_company_price_proposals where company_id=p_company and created_at>clock_timestamp()-interval '1 day')>=30
 then raise exception using errcode='22023',message='Limite quotidienne de projets de tarifs atteinte';end if;
 insert into private.platform_company_price_proposals
  (company_id,proposal_version,plan_id,plan_version,snapshot,cadence,seats,monthly_cents,annual_cents,due_cents,effective_on,reason,actor_id)
 values(p_company,last_version+1,p_plan,(quote->>'plan_version')::integer,quote->'snapshot',
   p_cadence,p_seats,(quote->>'monthly_cents')::bigint,(quote->>'annual_cents')::bigint,
   (quote->>'due_cents')::bigint,p_effective_on,btrim(p_reason),auth.uid())
 returning * into newrow;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposal_created',p_company,
  jsonb_build_object('proposal_id',newrow.id,'version',newrow.proposal_version,'reason',btrim(p_reason),
    'cadence',p_cadence,'due_cents',newrow.due_cents,'status','draft_pending_stripe'));
 return jsonb_build_object('id',newrow.id,'company_id',p_company,'version',newrow.proposal_version,
   'status',newrow.status,'payment_confirmed',false,'stripe_confirmed',false);
end $fn$;
revoke all on function public.platform_company_price_preview(uuid,text,text,integer,integer,integer,integer,integer,date,text),
 public.platform_company_price_list(uuid,text),
 public.platform_company_price_draft(uuid,text,text,integer,integer,integer,integer,integer,date,integer,text,text)
 from public,anon;
grant execute on function public.platform_company_price_preview(uuid,text,text,integer,integer,integer,integer,integer,date,text),
 public.platform_company_price_list(uuid,text),
 public.platform_company_price_draft(uuid,text,text,integer,integer,integer,integer,integer,date,integer,text,text)
 to authenticated;
