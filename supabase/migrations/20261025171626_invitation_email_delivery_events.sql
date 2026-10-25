create table private.invitation_email_events(event_id text primary key,provider_id text not null,event_type text not null,created_at timestamptz not null default now());
create index invitation_email_events_provider on private.invitation_email_events(provider_id,event_type);
alter table private.invitation_email_events enable row level security;
revoke all on private.invitation_email_events from public,anon,authenticated;
create function private.apply_invitation_email_events(p_provider text) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.worker_invitation_email q set status=case
 when exists(select 1 from private.invitation_email_events where provider_id=p_provider and event_type='email.opened') then 'opened'
 when exists(select 1 from private.invitation_email_events where provider_id=p_provider and event_type in('email.bounced','email.failed','email.complained')) then 'failed'
 when exists(select 1 from private.invitation_email_events where provider_id=p_provider and event_type='email.delivered') then 'delivered' else q.status end,updated_at=clock_timestamp()
 where q.provider_id=p_provider and q.status in('sent','delivered','opened','failed');
end $$;
create function public.invitation_email_event(p_event text,p_provider text,p_type text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_event is null or length(p_event) not between 1 and 200 or p_provider is null or length(p_provider) not between 1 and 200 or p_type is null or p_type not in('email.sent','email.delivered','email.opened','email.bounced','email.failed','email.complained') then raise exception 'Événement courriel invalide';end if;
 insert into private.invitation_email_events(event_id,provider_id,event_type) values(p_event,p_provider,p_type) on conflict do nothing;
 perform private.apply_invitation_email_events(p_provider);
end $$;
create function private.invitation_email_finish_events() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.provider_id is not null and new.provider_id is distinct from old.provider_id then perform private.apply_invitation_email_events(new.provider_id);end if;return new;
end $$;
create trigger invitation_email_finish_events after update of provider_id on private.worker_invitation_email for each row execute function private.invitation_email_finish_events();
create function private.cleanup_invitation_email() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.worker_invitation_email q set encrypted_token=null,status=case when q.status in('ready','retry','sending','unknown') then 'cancelled' else q.status end,updated_at=clock_timestamp() from private.worker_invitations i where q.invitation_id=i.id and q.encrypted_token is not null and (i.expires_at<=clock_timestamp() or i.accepted_at is not null or i.revoked_at is not null);
 delete from private.worker_invitation_email where encrypted_token is null and updated_at<clock_timestamp()-interval '90 days';
 delete from private.invitation_email_events where created_at<clock_timestamp()-interval '90 days';
end $$;
revoke all on function private.apply_invitation_email_events(text),private.invitation_email_finish_events(),private.cleanup_invitation_email() from public,anon,authenticated;
revoke all on function public.invitation_email_event(text,text,text) from public,anon,authenticated;
grant execute on function public.invitation_email_event(text,text,text) to service_role;
select cron.schedule('punch-invitation-email-retention','*/15 * * * *','select private.cleanup_invitation_email()');
