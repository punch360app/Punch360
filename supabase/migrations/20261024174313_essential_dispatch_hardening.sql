-- Seat accounting must include humans without Auth, including old invitation paths.
create function private.billable_people(p_company uuid) returns bigint language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.companies where id=p_company and product_edition='essential') then
 (select count(*) from public.company_workers w where w.company_id=p_company and w.status='active' and (w.auth_user_id is null or not exists(select 1 from private.platform_owner o where o.user_id=w.auth_user_id)))
 else (select count(*) from public.company_members where company_id=p_company and status='active') end
$$;
revoke all on function private.billable_people(uuid) from public,anon,authenticated;
do $$
declare d text;n text;
begin
 select pg_get_functiondef('public.create_company_invitation(uuid,text,text,integer)'::regprocedure) into d;
 n:=replace(d,'(select count(*) from public.company_members where company_id=p_company and status=''active'')','private.billable_people(p_company)');
 if n=d then raise exception 'Invitation count source changed';end if;execute n;
 select pg_get_functiondef('public.accept_company_invitation(text)'::regprocedure) into d;
 n:=replace(d,'(select count(*) from public.company_members where company_id=c.id and status=''active'')','private.billable_people(c.id)');
 if n=d then raise exception 'Invitation acceptance source changed';end if;execute n;
 select pg_get_functiondef('public.create_essential_worker(uuid,text,text,text,text,text,boolean)'::regprocedure) into d;
 n:=replace(d,'select count(*) into counted from public.company_workers where company_id=p_company and status=''active'';',
 'select private.billable_people(p_company)+(select count(*) from private.company_invitations where company_id=p_company and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) into counted;');
 if n=d then raise exception 'Worker count source changed';end if;execute n;
end $$;
-- Callback inbox closes the race between provider callbacks and the send response.
create table private.sms_delivery_receipts (
 message_sid text primary key check(message_sid ~ '^SM[0-9a-fA-F]{32}$'),
 status text not null check(status in ('sent','delivered','undelivered','failed')),updated_at timestamptz not null default now()
);
alter table private.sms_delivery_receipts enable row level security;
revoke all on private.sms_delivery_receipts from public,anon,authenticated;
create or replace function public.worker_invitation_sms_callback(p_message text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare current_status text;
begin
 if p_status is null or p_status not in ('sent','delivered','undelivered','failed') then return;end if;
 insert into private.sms_delivery_receipts(message_sid,status) values(p_message,p_status)
 on conflict(message_sid) do update set status=case when sms_delivery_receipts.status in ('delivered','undelivered','failed') then sms_delivery_receipts.status else excluded.status end,updated_at=clock_timestamp()
 returning status into current_status;
 update private.worker_invitations set sms_status=current_status where provider_message_id=p_message and sms_status in ('sending','sent','unknown');
end $$;
create or replace function public.worker_invitation_sms_result(p_invitation uuid,p_status text,p_message text default null) returns void language plpgsql security definer set search_path='' as $$
declare receipt text;
begin
 if p_status is null or p_status not in ('sent','failed','unknown') then raise exception 'État invalide';end if;
 if p_message is not null then
  -- Shared lock order with callback registration: serialize by provider ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_message,0));
  select status into receipt from private.sms_delivery_receipts where message_sid=p_message;
 end if;
 update private.worker_invitations set sms_status=coalesce(receipt,p_status),provider_message_id=p_message where id=p_invitation and sms_status='sending';
end $$;
-- Same lock must precede receipt write; this is internal and only service_role may call it.
do $$
declare d text;
begin
 select pg_get_functiondef('public.worker_invitation_sms_callback(text,text)'::regprocedure) into d;
 execute replace(d,'insert into private.sms_delivery_receipts',E'perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_message,0));\n insert into private.sms_delivery_receipts');
end $$;
