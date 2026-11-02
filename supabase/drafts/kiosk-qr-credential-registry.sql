-- DESIGN DRAFT ONLY. NOT A MIGRATION; NEVER AUTOMATICALLY APPLIED.
-- Move into a dated migration with Supabase CLI only after authorization,
-- SQL review, test-database validation and a secure QR verification RPC.
-- A QR by itself is NOT proof of identity. Independent PIN remains mandatory.
-- These functions only issue/revoke a one-time-visible card; they CANNOT punch.

create table private.kiosk_qr_enrollments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 worker_id uuid not null,
 token_hash bytea not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 revoked_at timestamptz,
 foreign key (company_id,worker_id) references public.company_workers(company_id,id)
);
create index kiosk_qr_enrollment_worker on private.kiosk_qr_enrollments(company_id,worker_id,created_at desc);
alter table private.kiosk_qr_enrollments enable row level security;
revoke all on table private.kiosk_qr_enrollments from public,anon,authenticated;

create table private.kiosk_qr_cards (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 worker_id uuid not null,
 enrolled_user_id uuid not null references auth.users(id),
 -- Random app installation identifier, NOT hardware attestation.
 installation_id uuid not null,
 token_hash bytea not null unique,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 foreign key (company_id,worker_id) references public.company_workers(company_id,id)
);
-- Single active QR per worker; replacement revokes the previous card first.
create unique index kiosk_qr_one_active_worker
 on private.kiosk_qr_cards(company_id,worker_id) where revoked_at is null;
create index kiosk_qr_card_owner on private.kiosk_qr_cards(company_id,enrolled_user_id,created_at desc);
alter table private.kiosk_qr_cards enable row level security;
revoke all on table private.kiosk_qr_cards from public,anon,authenticated;

-- Boss/Admin issues a 15-minute one-time enrollment code for an already
-- linked employee account. No QR card or employee token is returned to Boss.
create function public.create_worker_qr_enrollment(p_worker uuid)
returns text language plpgsql security definer set search_path='' as $$
declare w public.company_workers; token text; now_at timestamptz:=clock_timestamp();
begin
 if p_worker is null then raise exception using errcode='42501',message='Accès refusé';end if;
 select * into w from public.company_workers where id=p_worker for update;
 now_at:=clock_timestamp(); -- refresh after any lock wait
 if not found or not private.can_administer(w.company_id) then
  raise exception using errcode='42501',message='Accès refusé';
 end if;
 if w.status<>'active' or not w.can_kiosk_punch or not w.personal_access
    or w.auth_user_id is null or w.role not in ('employee','lead','boss')
    or not exists(select 1 from public.companies c where c.id=w.company_id and c.product_edition='essential')
    or not exists(select 1 from public.company_members m
     where m.company_id=w.company_id and m.user_id=w.auth_user_id and m.status='active') then
  raise exception 'Compte personnel actif et pointage tablette requis';
 end if;
 update private.kiosk_qr_enrollments
  set revoked_at=now_at where company_id=w.company_id and worker_id=w.id
   and consumed_at is null and revoked_at is null;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.kiosk_qr_enrollments(company_id,worker_id,token_hash,created_by,expires_at)
  values(w.company_id,w.id,sha256(convert_to(token,'UTF8')),auth.uid(),now_at+interval '15 minutes');
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
  values(w.company_id,auth.uid(),'qr_enrollment_requested',w.id,'Code temporaire remis en personne; jamais dans URL ou journal');
 return token;
end $$;

-- Employee's authenticated phone consumes an admin challenge only once.
-- Caller-supplied installation UUID is metadata, never a trusted proof that
-- the actual physical phone is present. QR + separate PIN are always needed.
create function public.activate_my_kiosk_qr_card(
 p_company uuid,p_enrollment text,p_installation uuid)
returns text language plpgsql security definer set search_path='' as $$
declare w public.company_workers; challenge private.kiosk_qr_enrollments;
 card_secret text;card_code text;now_at timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or p_company is null
  or p_enrollment is null or p_enrollment !~ '^[0-9a-f]{64}$'
  or p_installation is null or p_installation='00000000-0000-0000-0000-000000000000'::uuid then
  raise exception using errcode='42501',message='Activation refusée';
 end if;
 select * into w from public.company_workers
  where company_id=p_company and auth_user_id=auth.uid() for update;
 if not found or w.status<>'active' or not w.personal_access
  or not w.can_kiosk_punch or w.role not in ('employee','lead','boss')
  or not exists(select 1 from public.company_members m
      where m.company_id=p_company and m.user_id=auth.uid() and m.status='active')
  or not exists(select 1 from public.companies c
      where c.id=p_company and c.product_edition='essential') then
  raise exception using errcode='42501',message='Activation refusée';
 end if;
 select * into challenge from private.kiosk_qr_enrollments
  where company_id=p_company and worker_id=w.id
   and token_hash=sha256(convert_to(p_enrollment,'UTF8')) for update;
 now_at:=clock_timestamp(); -- expired while waiting remains expired
 if not found or challenge.consumed_at is not null or challenge.revoked_at is not null
    or challenge.expires_at<=now_at then
  raise exception using errcode='42501',message='Activation refusée';
 end if;
 update private.kiosk_qr_enrollments set consumed_at=now_at where id=challenge.id;
 update private.kiosk_qr_cards set revoked_at=now_at
  where company_id=p_company and worker_id=w.id and revoked_at is null;
 card_secret:=encode(extensions.gen_random_bytes(32),'hex');
 card_code:='P360C1.'||card_secret;
 insert into private.kiosk_qr_cards(company_id,worker_id,enrolled_user_id,installation_id,token_hash,expires_at)
  values(p_company,w.id,auth.uid(),p_installation,sha256(convert_to(card_code,'UTF8')),now_at+interval '1 year');
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
  values(p_company,auth.uid(),'qr_card_rotated',w.id,'Nouvelle carte QR, ancienne révoquée; secret visible une fois au salarié');
 return card_code;
end $$;

-- Self-service revocation is allowed even when the employee became inactive.
create function public.revoke_my_kiosk_qr_card(p_company uuid)
returns void language plpgsql security definer set search_path='' as $$
declare w public.company_workers; now_at timestamptz:=clock_timestamp();
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Accès refusé';end if;
 select * into w from public.company_workers
  where company_id=p_company and auth_user_id=auth.uid() for update;
 now_at:=clock_timestamp();
 if not found then raise exception using errcode='42501',message='Accès refusé';end if;
 update private.kiosk_qr_cards set revoked_at=now_at
  where company_id=w.company_id and worker_id=w.id and revoked_at is null;
 update private.kiosk_qr_enrollments set revoked_at=now_at
  where company_id=w.company_id and worker_id=w.id and consumed_at is null and revoked_at is null;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
  values(w.company_id,auth.uid(),'qr_card_self_revoked',w.id,'Révocation personnelle');
end $$;

-- Boss/Admin revocation never discloses a credential.
create function public.revoke_worker_kiosk_qr_card(p_worker uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare w public.company_workers; now_at timestamptz:=clock_timestamp();
begin
 select * into w from public.company_workers where id=p_worker for update;
 now_at:=clock_timestamp();
 if not found or not private.is_manager(w.company_id) then
  raise exception using errcode='42501',message='Accès refusé';
 end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>300 then
  raise exception 'Motif requis';end if;
 update private.kiosk_qr_cards set revoked_at=now_at
  where company_id=w.company_id and worker_id=w.id and revoked_at is null;
 update private.kiosk_qr_enrollments set revoked_at=now_at
  where company_id=w.company_id and worker_id=w.id and consumed_at is null and revoked_at is null;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
  values(w.company_id,auth.uid(),'qr_card_admin_revoked',w.id,trim(p_reason));
end $$;

-- Self-service status uses only the authenticated account's stable worker.
-- Never return the QR, its hash, installation identifier, enrollment challenge
-- or another employee's presence. A read cannot re-activate an expired card.
create function public.my_kiosk_qr_card_status(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $qr_body$
declare w public.company_workers;card private.kiosk_qr_cards;
begin
 if auth.uid() is null or p_company is null then
  raise exception using errcode='42501',message='Accès refusé';
 end if;
 select * into w from public.company_workers
  where company_id=p_company and auth_user_id=auth.uid();
 if not found or w.status<>'active' or not w.personal_access
  or not exists(select 1 from public.company_members m
    where m.company_id=p_company and m.user_id=auth.uid() and m.status='active') then
  raise exception using errcode='42501',message='Accès refusé';
 end if;
 select * into card from private.kiosk_qr_cards
  where company_id=p_company and worker_id=w.id and enrolled_user_id=auth.uid()
   and revoked_at is null and expires_at>now()
  order by created_at desc limit 1;
 return jsonb_build_object(
  'active',found,
  'issued_at',case when found then card.created_at else null end,
  'expires_at',case when found then card.expires_at else null end);
end $qr_body$;

-- Boss/Admin sees enrollment status for their own staff, never the secret or
-- an installation identifier. Management access is checked inside the RPC.
create function public.list_kiosk_qr_card_status(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $qr_body$
declare result jsonb;
begin
 if p_company is null or not private.is_manager(p_company) then
  raise exception using errcode='42501',message='Accès refusé';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'worker_id',w.id,
  'active',exists(
   select 1 from private.kiosk_qr_cards k
    where k.company_id=w.company_id and k.worker_id=w.id
      and k.enrolled_user_id=w.auth_user_id
      and k.revoked_at is null and k.expires_at>now()
  )
 ) order by w.id),'[]'::jsonb) into result
 from public.company_workers w where w.company_id=p_company
  and w.role in ('employee','lead','boss');
 return result;
end $qr_body$;

-- Any change of linked account or permission invalidates issued cards and
-- outstanding enrollment codes in the same transaction as the worker change.
create function private.revoke_kiosk_qr_on_worker_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status
 or new.can_kiosk_punch is distinct from old.can_kiosk_punch
 or new.personal_access is distinct from old.personal_access
 or new.auth_user_id is distinct from old.auth_user_id
 or new.company_id is distinct from old.company_id
 or new.role is distinct from old.role then
  update private.kiosk_qr_cards set revoked_at=clock_timestamp()
   where company_id=old.company_id and worker_id=old.id and revoked_at is null;
  update private.kiosk_qr_enrollments set revoked_at=clock_timestamp()
   where company_id=old.company_id and worker_id=old.id
    and consumed_at is null and revoked_at is null;
 end if;
 return new;
end $$;
revoke all on function private.revoke_kiosk_qr_on_worker_change() from public,anon,authenticated;
create trigger revoke_kiosk_qr_on_worker_change
 after update of status,can_kiosk_punch,personal_access,auth_user_id,role,company_id
 on public.company_workers for each row execute function private.revoke_kiosk_qr_on_worker_change();

-- Membership suspension or removal revokes credentials even when a
-- separate worker-sync trigger does not run. Both triggers are idempotent.
create function private.revoke_kiosk_qr_on_membership_change()
returns trigger language plpgsql security definer set search_path='' as $qr_body$
declare v_revoke boolean:=false;
begin
 if tg_op='DELETE' then
  v_revoke:=true;
 elsif tg_op='UPDATE' then
  v_revoke:=new.status is distinct from old.status
    or new.role is distinct from old.role
    or new.user_id is distinct from old.user_id
    or new.company_id is distinct from old.company_id;
 end if;
 if v_revoke then
  update private.kiosk_qr_cards set revoked_at=clock_timestamp()
   where company_id=old.company_id and enrolled_user_id=old.user_id
    and revoked_at is null;
  update private.kiosk_qr_enrollments set revoked_at=clock_timestamp()
   where company_id=old.company_id
    and worker_id in (
     select w.id from public.company_workers w
      where w.company_id=old.company_id and w.auth_user_id=old.user_id
    ) and consumed_at is null and revoked_at is null;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $qr_body$;
revoke all on function private.revoke_kiosk_qr_on_membership_change()
 from public,anon,authenticated;
create trigger revoke_kiosk_qr_on_membership_change
 after update of status,role,user_id,company_id or delete
 on public.company_members for each row
 execute function private.revoke_kiosk_qr_on_membership_change();

-- Explicit grants: public SECURITY DEFINER functions must not be executable
-- by PUBLIC/anon. Never grant table SELECT/INSERT/UPDATE/DELETE to API roles.
revoke all on function public.my_kiosk_qr_card_status(uuid) from public,anon,authenticated;
revoke all on function public.list_kiosk_qr_card_status(uuid) from public,anon,authenticated;
revoke all on function public.create_worker_qr_enrollment(uuid) from public,anon,authenticated;
revoke all on function public.activate_my_kiosk_qr_card(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.revoke_my_kiosk_qr_card(uuid) from public,anon,authenticated;
revoke all on function public.revoke_worker_kiosk_qr_card(uuid,text) from public,anon,authenticated;
grant execute on function public.my_kiosk_qr_card_status(uuid),
 public.list_kiosk_qr_card_status(uuid),
 public.create_worker_qr_enrollment(uuid),
 public.activate_my_kiosk_qr_card(uuid,text,uuid),
 public.revoke_my_kiosk_qr_card(uuid),
 public.revoke_worker_kiosk_qr_card(uuid,text) to authenticated;

-- IMPORTANT: no QR-to-identity verifier, no QR-to-punch RPC, no live
-- entitlement flag, and no connection to essential-kiosk Edge Function here.
