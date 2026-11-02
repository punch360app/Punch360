-- DESIGN DRAFT ONLY. NOT A MIGRATION, NOT DEPLOYED, NOT ENABLED.
-- Requires kiosk-qr-credential-registry.sql and the existing Essentiel
-- kiosk_execute migrations. Review SQL locks, privileges and DB tests before
-- any exposure via the Edge Function. Employee shows QR; tablet scans QR.
--
-- The existing kiosk_execute() remains the ONLY source for punch sessions,
-- breaks, worker PIN lockout, period closures, advisory locks and event
-- idempotency. This adapter never writes a punch event itself.
create function public.kiosk_qr_execute(
 p_device uuid,p_token text,p_card text,p_pin text,p_action text,p_event uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 device private.kiosk_devices;
 initial_card private.kiosk_qr_cards;
 card private.kiosk_qr_cards;
 worker public.company_workers;
 now_at timestamptz;
begin
 -- Validate *before* touching privileged tables, without returning secrets.
 if p_device is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or p_card is null or p_card !~ '^P360C1\.[0-9a-f]{64}$'
    or p_pin is null or p_pin !~ '^[0-9]{6,12}$'
    or p_action is null or p_action not in (
      'identify','in','out','break_start','break_start_paid','break_end')
    or (p_action<>'identify' and p_event is null)
    or (p_action='identify' and p_event is not null) then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;

 -- Same lock order as the deployed PIN RPC: device before any worker.
 -- Revocation of a device must acquire its row lock before returning.
 select * into device from private.kiosk_devices where id=p_device for update;
 now_at:=clock_timestamp();
 if not found or device.paired_at is null or device.revoked_at is not null
   or device.token_hash is distinct from sha256(convert_to(p_token,'UTF8'))
   or device.locked_until>now_at then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;
 -- This device is paired to a punch job, not just a company. A formerly
 -- valid device must not issue QR punches from a closed establishment or an
 -- inactive underlying job. Match the same company for every joined row.
 if not exists (
   select 1 from public.essential_locations location
    join public.jobs job on job.company_id=location.company_id
     and job.id=location.punch_job_id
   where location.company_id=device.company_id
    and location.punch_job_id=device.site_id
    and location.active and job.active
 ) then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;

 -- This first lookup finds a candidate only. It is NOT an authorization
 -- decision: all checks are re-evaluated after locking the worker + card.
 select * into initial_card from private.kiosk_qr_cards
  where company_id=device.company_id
    and token_hash=sha256(convert_to(p_card,'UTF8'));
 if not found then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;

 select * into worker from public.company_workers
  where company_id=device.company_id and id=initial_card.worker_id for update;
 if not found then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;
 select * into card from private.kiosk_qr_cards
  where id=initial_card.id and company_id=device.company_id
    and worker_id=worker.id and token_hash=sha256(convert_to(p_card,'UTF8'))
  for share;
 now_at:=clock_timestamp();
 if not found or card.revoked_at is not null or card.expires_at<=now_at
  or card.enrolled_user_id is distinct from worker.auth_user_id
  or worker.status<>'active' or not worker.can_kiosk_punch
  or not worker.personal_access or worker.role not in ('employee','lead','boss')
  or not exists(select 1 from public.company_members member
    where member.company_id=device.company_id
      and member.user_id=card.enrolled_user_id and member.status='active')
  or not exists(select 1 from public.companies co
    where co.id=device.company_id and co.product_edition='essential') then
  return jsonb_build_object('ok',false,'error','IDENTITY_DENIED');
 end if;

 -- PIN verification, lockouts, paid breaks, closing periods, replays and
 -- server-clock receipts are delegated to the original transaction while
 -- holding device/worker/card row locks. A phone screenshot is insufficient:
 -- the independent PIN is always required.
 return public.kiosk_execute(
   p_device,p_token,worker.employee_number,p_pin,p_action,p_event,null);
end $$;
-- PUBLIC obtains EXECUTE by default in PostgreSQL. Explicitly revoke it
-- before granting only the server role used by the existing Edge Function.
revoke all on function public.kiosk_qr_execute(uuid,text,text,text,text,uuid)
 from public,anon,authenticated;
grant execute on function public.kiosk_qr_execute(uuid,text,text,text,text,uuid)
 to service_role;
