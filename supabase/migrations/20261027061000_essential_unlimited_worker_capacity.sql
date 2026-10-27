-- SACATALOG-016: signed, CURRENT subscription is the only unlimited-seat authority.
-- All numeric companies, Construction, missing/old contracts, trial/test status,
-- grace/restricted and unconfirmed Stripe orders retain the original seat checks.
-- No provider price/contract/seat_limit row or production member is modified.
create function private.essential_contract_has_unlimited_members(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(
  select 1 from public.companies c
  join private.essential_billing_accounts a on a.company_id=c.id
  join private.essential_contracts contract
   on contract.company_id=c.id and contract.stripe_subscription_id=a.subscription_id
  where c.id=p_company
   and c.product_edition='essential' and not c.is_test
   and c.billing_status='active'
   and a.status='active' and a.paid_through>clock_timestamp()
   and private.essential_billing_state(c.id)='active'
   and contract.pricing_snapshot->'included_seats_unlimited'='true'::jsonb
 )
$fn$;
revoke all on function private.essential_contract_has_unlimited_members(uuid) from public,anon,authenticated;

-- Preserve the full pre-existing role/tenant, employee identity, audit, invite
-- lifecycle and active-billing checks. Only the seat threshold is conditional.
CREATE OR REPLACE FUNCTION public.create_company_invitation(p_company uuid, p_email text, p_role text, p_hours integer DEFAULT 72)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_token text:=gen_random_uuid()::text||gen_random_uuid()::text; v_id uuid; v_seats integer; v_count integer;
begin
 if exists(select 1 from public.companies where id=p_company and is_test) and lower(trim(p_email)) not like '%@punch360.test.invalid' then raise exception 'Invitation de test : adresse fictive réservée obligatoire';end if;
 if not private.can_administer(p_company) then raise exception 'Accès refusé'; end if;
 select seat_limit into v_seats from public.companies where id=p_company and billing_status='active' for update;
 if not found then raise exception 'Paiement actif obligatoire avant invitation'; end if;
 if p_role not in ('employee','lead','admin') or p_hours not between 1 and 168 or p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invitation invalide'; end if;
 select private.billable_people(p_company)+
 (select count(*) from private.company_invitations where company_id=p_company and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) into v_count;
 if v_count>=v_seats and not private.essential_contract_has_unlimited_members(p_company) then raise exception 'Places insuffisantes : achat requis'; end if;
 if exists(select 1 from private.company_invitations where company_id=p_company and email=lower(trim(p_email)) and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Invitation déjà en attente'; end if;
 insert into private.company_invitations(company_id,token_hash,email,role,created_by,expires_at)
 values(p_company,sha256(convert_to(v_token,'UTF8')),lower(trim(p_email)),p_role,auth.uid(),clock_timestamp()+make_interval(hours=>p_hours)) returning id into v_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'invitation_created',v_id,jsonb_build_object('role',p_role),'Invitation sécurisée');
 return jsonb_build_object('id',v_id,'token',v_token,'expires_in_hours',p_hours);
end $function$;

CREATE OR REPLACE FUNCTION public.accept_company_invitation(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r private.company_invitations; u auth.users; c public.companies;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select * into r from private.company_invitations where token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then raise exception 'Invitation invalide'; end if;
 select * into c from public.companies where id=r.company_id for update;
 select * into r from private.company_invitations where id=r.id for update;
 if r.accepted_at is not null or r.revoked_at is not null or r.expires_at<=clock_timestamp() then raise exception 'Invitation expirée ou utilisée'; end if;
 select * into u from auth.users where id=auth.uid();
 if u.email_confirmed_at is null or lower(u.email)<>r.email then raise exception 'Connecte-toi avec le courriel invité et confirmé'; end if;
 if c.billing_status<>'active' then raise exception 'Paiement de la compagnie requis'; end if;
 if exists(select 1 from public.company_members where company_id=c.id and user_id=auth.uid()) then raise exception 'Déjà membre de cette compagnie'; end if;
 if private.billable_people(c.id)>=c.seat_limit and not private.essential_contract_has_unlimited_members(c.id) then raise exception 'Limite de places atteinte'; end if;
 insert into public.company_members(company_id,user_id,role) values(c.id,auth.uid(),r.role);
 update private.company_invitations set accepted_at=clock_timestamp(),accepted_by=auth.uid() where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(c.id,auth.uid(),'invitation_accepted',r.id,jsonb_build_object('role',r.role),'Adhésion au rôle invité');
 return c.id;
end $function$;

CREATE OR REPLACE FUNCTION public.create_essential_worker(p_company uuid, p_number text, p_first text, p_last text DEFAULT ''::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_sms_consent boolean DEFAULT false)
 RETURNS company_workers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result public.company_workers;c public.companies;counted integer;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire autorisé requis';end if;
 select * into c from public.companies where id=p_company for update;
 if c.product_edition<>'essential' then raise exception 'Édition Essentiel requise';end if;
 select private.billable_people(p_company)+(select count(*) from private.company_invitations where company_id=p_company and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) into counted;
 if counted>=c.seat_limit and not private.essential_contract_has_unlimited_members(p_company) then raise exception 'Places insuffisantes. Ajuster l’abonnement avant de créer le salarié.';end if;
 if p_first is null or p_number is null then raise exception 'Prénom et matricule requis';end if;
 insert into public.company_workers(company_id,employee_number,first_name,last_name,email,phone,sms_consent_at)
 values(p_company,trim(p_number),trim(p_first),trim(coalesce(p_last,'')),nullif(lower(trim(p_email)),''),nullif(trim(p_phone),''),case when p_sms_consent is true and nullif(trim(p_phone),'') is not null then clock_timestamp() end) returning * into result;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'worker_created',result.id,jsonb_build_object('employee_number',result.employee_number,'has_auth_account',false),'Création du dossier salarié stable');
 return result;
end $function$;
