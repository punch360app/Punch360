create table private.push_devices(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),user_id uuid not null references auth.users(id),session_id uuid not null,
 token text not null,platform text not null check(platform in('ios','android')),updated_at timestamptz not null default now(),revoked_at timestamptz,unique(company_id,user_id,token)
);
create index push_devices_recipient on private.push_devices(company_id,user_id) where revoked_at is null;
alter table private.push_devices enable row level security;
revoke all on private.push_devices from public,anon,authenticated;
create function public.register_push_device(p_company uuid,p_token text,p_platform text) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;result uuid;
begin
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 if not private.is_member(p_company) or sid is null or not exists(select 1 from auth.sessions where id=sid and user_id=auth.uid()) then raise exception using errcode='42501',message='Session active requise';end if;
 if p_platform is null or p_platform not in('ios','android') or p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'Appareil push invalide';end if;
 perform pg_advisory_xact_lock(hashtextextended('push-token:'||p_token,0));
 -- A token on a shared handset must never remain attached to a previous account.
 update private.push_devices set revoked_at=clock_timestamp() where token=p_token and user_id<>auth.uid() and revoked_at is null;
 if (select count(*) from private.push_devices where company_id=p_company and user_id=auth.uid() and revoked_at is null and token<>p_token)>=10 then raise exception 'Maximum dix appareils autorisés';end if;
 insert into private.push_devices(company_id,user_id,session_id,token,platform) values(p_company,auth.uid(),sid,p_token,p_platform)
 on conflict(company_id,user_id,token) do update set session_id=excluded.session_id,platform=excluded.platform,updated_at=clock_timestamp(),revoked_at=null returning id into result;return result;
end $$;
create function public.list_push_devices(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Membre actif requis';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'platform',platform,'updated_at',updated_at,'revoked_at',revoked_at) order by updated_at desc) from private.push_devices where company_id=p_company and user_id=auth.uid()),'[]');
end $$;
create function public.revoke_push_device(p_device uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.push_devices set revoked_at=clock_timestamp() where id=p_device and user_id=auth.uid() and private.is_member(company_id);
 if not found then raise exception using errcode='42501',message='Appareil personnel inaccessible';end if;
end $$;
create function private.notification_category(kind text) returns text language sql immutable set search_path='' as $$
 select case when kind like '%decision%' or kind in('missing_day','offline_review') then 'decisions' when kind like '%shift%' or kind like '%schedule%' then 'schedule' when kind='announcement' then 'announcements' when kind like '%certification%' or kind like '%long_session%' or kind like '%reminder%' then 'reminders' else 'other' end
$$;
create table private.push_outbox(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.app_notifications(id),device_id uuid not null references private.push_devices(id),
 status text not null default 'queued' check(status in('queued','sending','accepted','provider_received','retry','failed','cancelled','unknown')),
 attempts integer not null default 0,available_at timestamptz not null default now(),lease uuid,claimed_at timestamptz,ticket_id text,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(notification_id,device_id)
);
alter table private.push_outbox enable row level security;
revoke all on private.push_outbox from public,anon,authenticated;
create index push_outbox_pending on private.push_outbox(available_at,created_at) where status in('queued','retry','accepted');
create function private.enqueue_notification_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.push_outbox(notification_id,device_id)
 select new.id,d.id from private.push_devices d join public.notification_preferences p on p.company_id=d.company_id and p.user_id=d.user_id and p.category=private.notification_category(new.kind) and p.push_enabled
 join public.company_members m on m.company_id=d.company_id and m.user_id=d.user_id and m.status='active'
 where d.company_id=new.company_id and d.user_id=new.recipient_id and d.revoked_at is null and d.updated_at>clock_timestamp()-interval '90 days' and exists(select 1 from auth.sessions where id=d.session_id and user_id=d.user_id)
 on conflict do nothing;return new;
end $$;
create trigger enqueue_notification_push after insert on public.app_notifications for each row execute function private.enqueue_notification_push();
-- Service-only lease: transport timeouts are marked unknown, never blindly resent.
create function public.claim_push_delivery() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update private.push_outbox set status='unknown',error_code='LeaseExpired',updated_at=clock_timestamp() where status='sending' and claimed_at<clock_timestamp()-interval '5 minutes';
 update private.push_outbox o set status='cancelled',updated_at=clock_timestamp() from private.push_devices d,public.app_notifications n where o.device_id=d.id and o.notification_id=n.id and o.status in('queued','retry','accepted') and
 (d.revoked_at is not null or not exists(select 1 from auth.sessions where id=d.session_id and user_id=d.user_id) or not exists(select 1 from public.company_members where company_id=d.company_id and user_id=d.user_id and status='active') or not exists(select 1 from public.notification_preferences where company_id=d.company_id and user_id=d.user_id and category=private.notification_category(n.kind) and push_enabled));
 with candidates as(select id from private.push_outbox where status in('queued','retry','accepted') and available_at<=clock_timestamp() and attempts<5 order by available_at,created_at for update skip locked limit 20),claimed as(
 update private.push_outbox o set lease=gen_random_uuid(),claimed_at=clock_timestamp(),attempts=attempts+1,status='sending',updated_at=clock_timestamp() from candidates c where o.id=c.id returning o.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'lease',o.lease,'ticket_id',o.ticket_id,'token',d.token,'notification_id',o.notification_id,'company_id',d.company_id)),'[]') into result from claimed o join private.push_devices d on d.id=o.device_id;return result;
end $$;
create function public.finish_push_delivery(p_id uuid,p_lease uuid,p_status text,p_ticket text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare item private.push_outbox;
begin
 if p_status is null or p_status not in('accepted','provider_received','retry','failed','unknown') or length(coalesce(p_ticket,''))>200 or length(coalesce(p_error,''))>100 then raise exception 'Résultat push invalide';end if;
 select * into item from private.push_outbox where id=p_id and lease=p_lease and status='sending' for update;
 if not found then raise exception 'Bail de livraison expiré';end if;
 if p_status='accepted' and p_ticket is null then raise exception 'Ticket requis';end if;
 update private.push_outbox set status=case when p_status='retry' and attempts>=5 then 'failed' else p_status end,ticket_id=coalesce(p_ticket,ticket_id),error_code=p_error,available_at=clock_timestamp()+case when p_status='accepted' then interval '15 minutes' else make_interval(secs=>least(3600,30*power(2,attempts)::integer)) end,updated_at=clock_timestamp() where id=item.id;
 if p_error='DeviceNotRegistered' then update private.push_devices set revoked_at=clock_timestamp() where id=item.device_id;end if;
end $$;
revoke all on function private.notification_category(text),private.enqueue_notification_push() from public,anon,authenticated;
revoke all on function public.register_push_device(uuid,text,text),public.list_push_devices(uuid),public.revoke_push_device(uuid) from public,anon;
grant execute on function public.register_push_device(uuid,text,text),public.list_push_devices(uuid),public.revoke_push_device(uuid) to authenticated;
revoke all on function public.claim_push_delivery(),public.finish_push_delivery(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_push_delivery(),public.finish_push_delivery(uuid,uuid,text,text,text) to service_role;
create function private.revoke_departed_push_devices() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'active' then update private.push_devices set revoked_at=clock_timestamp() where company_id=new.company_id and user_id=new.user_id and revoked_at is null;end if;return new;
end $$;
revoke all on function private.revoke_departed_push_devices() from public,anon,authenticated;
create trigger revoke_departed_push_devices after update of status on public.company_members for each row execute function private.revoke_departed_push_devices();
