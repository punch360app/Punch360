do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.claim_push_delivery()'::regprocedure);
 changed:=replace(source,'(d.revoked_at is not null or','(n.read_at is not null or n.created_at<clock_timestamp()-interval ''24 hours'' or d.updated_at<clock_timestamp()-interval ''90 days'' or d.revoked_at is not null or');
 if changed=source then raise exception 'Push claim source changed';end if;execute changed;
end $migration$;
-- Purge only terminal transport metadata and inactive device tokens, never inbox/business data.
create function private.cleanup_push_delivery() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.push_devices set revoked_at=coalesce(revoked_at,clock_timestamp()) where updated_at<clock_timestamp()-interval '90 days' and revoked_at is null;
 update private.push_outbox set status='cancelled',error_code='Expired',updated_at=clock_timestamp() where status in('queued','retry','accepted','unknown') and created_at<clock_timestamp()-interval '24 hours';
 delete from private.push_outbox where status in('provider_received','failed','cancelled','unknown') and updated_at<clock_timestamp()-interval '90 days';
 delete from private.push_devices d where d.revoked_at<clock_timestamp()-interval '90 days' and not exists(select 1 from private.push_outbox o where o.device_id=d.id);
end $$;
revoke all on function private.cleanup_push_delivery() from public,anon,authenticated;
select cron.schedule('punch-push-retention','37 3 * * *','select private.cleanup_push_delivery()');
