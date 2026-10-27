-- SACATALOG-016 part 2: immutable company-specific quotations with explicit unlimited inclusion.
-- Keep all V1 RPC signatures for pre-existing clients and all current contract snapshots.
-- No Stripe action, contract change, active tariff update or existing proposal rewrite.
create function private.platform_company_price_calculate_v2(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,
 p_effective_on date,p_included_unlimited boolean
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare quote jsonb;extras integer;
begin
 if p_included_unlimited is null or p_included is null or p_included not between 1 and 100000
 then raise exception using errcode='22023',message='Mode de membres inclus invalide';end if;
 -- Reuse V1 tenant, catalogue, date, occupied-seat, overflow and currency checks.
 -- When unlimited, the actual requested seat count is used only as the calculation
 -- boundary; the original numeric base remains in the snapshot.
 quote:=private.platform_company_price_calculate(
  p_company,p_plan,p_cadence,p_seats,p_base,
  case when p_included_unlimited then p_seats else p_included end,
  p_extra,p_discount,p_effective_on
 );
 extras:=case when p_included_unlimited then 0 else greatest(0,p_seats-p_included) end;
 return quote||jsonb_build_object(
  'included_seats_unlimited',p_included_unlimited,'extra_seats',extras,
  'snapshot',(quote->'snapshot')||jsonb_build_object(
   'included_seats',p_included,'included_seats_unlimited',p_included_unlimited
  )
 );
end $fn$;
revoke all on function private.platform_company_price_calculate_v2(
 uuid,text,text,integer,integer,integer,integer,integer,date,boolean
) from public,anon,authenticated;

create function public.platform_company_price_preview_v2(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,
 p_effective_on date,p_reason text,p_included_unlimited boolean
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare quote jsonb;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 then raise exception using errcode='22023',message='Motif requis';end if;
 quote:=private.platform_company_price_calculate_v2(
  p_company,p_plan,p_cadence,p_seats,p_base,p_included,p_extra,p_discount,
  p_effective_on,p_included_unlimited
 );
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposal_preview',p_company,
  jsonb_build_object('reason',btrim(p_reason),'plan',p_plan,
   'effective_on',p_effective_on,'included_unlimited',p_included_unlimited));
 return quote;
end $fn$;

create function public.platform_company_price_list_v2(
 p_company uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.companies;items jsonb;version integer;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 then raise exception using errcode='22023',message='Motif requis';end if;
 select * into c from public.companies where id=p_company;
 if not found or c.product_edition<>'essential' or c.is_test
 then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select coalesce(max(proposal_version),0) into version
 from private.platform_company_price_proposals where company_id=p_company;
 select coalesce(jsonb_agg(z order by z.proposal_version desc),'[]'::jsonb) into items
 from (select id,proposal_version,plan_id,plan_version,cadence,seats,
   monthly_cents,annual_cents,due_cents,currency,effective_on,status,
   actor_id,created_at,
   coalesce(snapshot->'included_seats_unlimited'='true'::jsonb,false) as included_seats_unlimited,
   (snapshot->>'included_seats')::integer as included_seats
   from private.platform_company_price_proposals where company_id=p_company
   order by proposal_version desc limit 20) z;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposals_read',p_company,
  jsonb_build_object('reason',btrim(p_reason),'returned',jsonb_array_length(items)));
 return jsonb_build_object('company_id',p_company,'version',version,
  'items',items,'stripe_confirmed',false);
end $fn$;

create function public.platform_company_price_draft_v2(
 p_company uuid,p_plan text,p_cadence text,p_seats integer,
 p_base integer,p_included integer,p_extra integer,p_discount integer,
 p_effective_on date,p_expected_version integer,p_expected_plan_version integer,
 p_confirmation text,p_reason text,p_included_unlimited boolean
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.companies;quote jsonb;last_version integer;
 newrow private.platform_company_price_proposals;
begin
 perform private.assert_live_platform_session();
 if length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 or p_confirmation is distinct from p_company::text
 or p_expected_version is null or p_expected_version<0
 or p_expected_plan_version is null or p_expected_plan_version<1
 then raise exception using errcode='22023',
  message='Confirmer identifiant exact, version et motif';end if;
 select * into c from public.companies where id=p_company for update;
 if not found or c.product_edition<>'essential' or c.is_test
 then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 select coalesce(max(proposal_version),0) into last_version
 from private.platform_company_price_proposals where company_id=p_company;
 if last_version<>p_expected_version then raise exception using errcode='40001',
  message='Proposition modifiée, recharger avant enregistrement';end if;
 quote:=private.platform_company_price_calculate_v2(
  p_company,p_plan,p_cadence,p_seats,p_base,p_included,p_extra,p_discount,
  p_effective_on,p_included_unlimited
 );
 if (quote->>'plan_version')::integer<>p_expected_plan_version
 then raise exception using errcode='40001',
  message='Forfait public mis à jour : prévisualiser de nouveau';end if;
 if (select count(*) from private.platform_company_price_proposals
  where company_id=p_company and created_at>clock_timestamp()-interval '1 day')>=30
 then raise exception using errcode='22023',
  message='Limite quotidienne de projets de tarifs atteinte';end if;
 insert into private.platform_company_price_proposals
  (company_id,proposal_version,plan_id,plan_version,snapshot,cadence,seats,
   monthly_cents,annual_cents,due_cents,effective_on,reason,actor_id)
 values(p_company,last_version+1,p_plan,(quote->>'plan_version')::integer,
  quote->'snapshot',p_cadence,p_seats,(quote->>'monthly_cents')::bigint,
  (quote->>'annual_cents')::bigint,(quote->>'due_cents')::bigint,
  p_effective_on,btrim(p_reason),auth.uid())
 returning * into newrow;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'company_price_proposal_created',p_company,
  jsonb_build_object('proposal_id',newrow.id,'version',newrow.proposal_version,
   'reason',btrim(p_reason),'cadence',p_cadence,'due_cents',newrow.due_cents,
   'included_unlimited',p_included_unlimited,'status','draft_pending_stripe'));
 return jsonb_build_object('id',newrow.id,'company_id',p_company,
  'version',newrow.proposal_version,'status',newrow.status,
  'payment_confirmed',false,'stripe_confirmed',false);
end $fn$;

revoke all on function public.platform_company_price_preview_v2(
 uuid,text,text,integer,integer,integer,integer,integer,date,text,boolean),
 public.platform_company_price_list_v2(uuid,text),
 public.platform_company_price_draft_v2(
 uuid,text,text,integer,integer,integer,integer,integer,date,integer,integer,text,text,boolean)
 from public,anon;
grant execute on function public.platform_company_price_preview_v2(
 uuid,text,text,integer,integer,integer,integer,integer,date,text,boolean),
 public.platform_company_price_list_v2(uuid,text),
 public.platform_company_price_draft_v2(
 uuid,text,text,integer,integer,integer,integer,integer,date,integer,integer,text,text,boolean)
 to authenticated;
notify pgrst,'reload schema';
