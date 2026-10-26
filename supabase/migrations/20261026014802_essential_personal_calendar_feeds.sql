-- Personal read-only iCalendar subscription. Random 256-bit bearer token: only a digest is stored.
create table private.essential_calendar_feed_tokens (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null,
 worker_id uuid not null,
 token_hash bytea not null unique,
 created_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 check(revoked_at is null or revoked_at>=created_at)
);
create unique index essential_calendar_one_active_feed
 on private.essential_calendar_feed_tokens(company_id,user_id) where revoked_at is null;
alter table private.essential_calendar_feed_tokens enable row level security;
revoke all on private.essential_calendar_feed_tokens from public,anon,authenticated;

create function private.assert_essential_calendar_owner(p_company uuid)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare worker_id uuid;worker_count integer;
begin
 if auth.uid() is null or not exists(select 1 from auth.sessions
   where id::text=auth.jwt()->>'session_id' and user_id=auth.uid()
    and (not_after is null or not_after>clock_timestamp()))
 then raise exception using errcode='42501',message='Session expirée : se reconnecter';end if;
 if not exists(select 1 from public.companies c join public.company_members m on m.company_id=c.id
   where c.id=p_company and c.product_edition='essential'
    and m.user_id=auth.uid() and m.status='active')
 then raise exception using errcode='42501',message='Appartenance Essentiel active requise';end if;
 select count(*) into worker_count
 from public.company_workers where company_id=p_company and auth_user_id=auth.uid()
  and status='active' and personal_access;
 select id into worker_id from public.company_workers where company_id=p_company
  and auth_user_id=auth.uid() and status='active' and personal_access limit 1;
 if worker_count<>1 then raise exception using errcode='42501',message='Dossier salarié personnel unique requis';end if;
 return worker_id;
end $fn$;
revoke all on function private.assert_essential_calendar_owner(uuid) from public,anon,authenticated;

create function public.personal_calendar_feed_status(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare employee uuid;feed private.essential_calendar_feed_tokens;
begin
 employee:=private.assert_essential_calendar_owner(p_company);
 select * into feed from private.essential_calendar_feed_tokens
  where company_id=p_company and user_id=auth.uid() and worker_id=employee and revoked_at is null;
 return jsonb_build_object('active',found,'created_at',feed.created_at,'company_id',p_company);
end $fn$;

create function public.personal_calendar_feed_rotate(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare employee uuid;token text;
begin
 employee:=private.assert_essential_calendar_owner(p_company);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal-calendar:'||p_company::text||':'||auth.uid()::text,0));
 update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
 where company_id=p_company and user_id=auth.uid() and revoked_at is null;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.essential_calendar_feed_tokens(company_id,user_id,worker_id,token_hash)
 values(p_company,auth.uid(),employee,extensions.digest(pg_catalog.decode(token,'hex'),'sha256'));
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'personal_calendar_feed_rotated',employee,'Lien privé du calendrier renouvelé');
 return jsonb_build_object('token',token,'company_id',p_company,'worker_id',employee,
 'secret_once',true,'revokes_previous',true);
end $fn$;

create function public.personal_calendar_feed_revoke(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare employee uuid;affected integer;
begin
 employee:=private.assert_essential_calendar_owner(p_company);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal-calendar:'||p_company::text||':'||auth.uid()::text,0));
 update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
 where company_id=p_company and user_id=auth.uid() and revoked_at is null;
 get diagnostics affected=row_count;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'personal_calendar_feed_revoked',employee,'Lien privé du calendrier révoqué');
 return jsonb_build_object('revoked',affected>0,'active',false);
end $fn$;

-- Service-role-only lookup. Does not rely on user editable metadata.
-- Every read rechecks live company membership, worker access and Auth account.
create function public.personal_calendar_feed_read(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare feed private.essential_calendar_feed_tokens;shifts jsonb;locations jsonb;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null;end if;
 select * into feed from private.essential_calendar_feed_tokens
 where token_hash=extensions.digest(pg_catalog.decode(p_token,'hex'),'sha256')
  and revoked_at is null limit 1;
 if not found then return null;end if;
 if not exists(select 1 from public.companies c join public.company_members m on m.company_id=c.id
  join public.company_workers w on w.company_id=c.id and w.id=feed.worker_id
  join auth.users u on u.id=feed.user_id
  where c.id=feed.company_id and c.product_edition='essential'
   and m.user_id=feed.user_id and m.status='active'
   and w.auth_user_id=feed.user_id and w.status='active' and w.personal_access
   and u.deleted_at is null)
 then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at,x.id),'[]'::jsonb)
 into shifts from (
  select s.id,s.company_id,s.worker_id,s.location_id,s.starts_at,s.ends_at,s.version,s.cancelled_at
  from public.scheduled_shifts s where s.company_id=feed.company_id and s.worker_id=feed.worker_id
   and s.ends_at>=now()-interval '30 days'
   and s.starts_at<=now()+interval '365 days'
  order by s.starts_at,s.id limit 1001
 ) x;
 if jsonb_array_length(shifts)>1000 then
  -- No silently truncated calendars.
  raise exception using errcode='54000',message='Too many calendar events';
 end if;
 select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) into locations
 from (select loc.id,loc.company_id,loc.name
       from public.essential_locations loc where loc.company_id=feed.company_id
        and exists(select 1 from public.scheduled_shifts s where s.company_id=feed.company_id
          and s.worker_id=feed.worker_id and s.location_id=loc.id
          and s.ends_at>=now()-interval '30 days'
          and s.starts_at<=now()+interval '365 days')
 ) l;
 return jsonb_build_object('company_id',feed.company_id,'worker_id',feed.worker_id,
  'shifts',shifts,'locations',locations,'read_only',true);
end $fn$;


-- Immediately invalidate links on role removal, membership closure or change.
create function private.revoke_calendar_feed_on_membership()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if tg_op='DELETE' then
  update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
   where company_id=old.company_id and user_id=old.user_id and revoked_at is null;
  return old;
 end if;
 if new.status is distinct from old.status or new.role is distinct from old.role then
  update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
   where company_id=new.company_id and user_id=new.user_id and revoked_at is null;
 end if;
 return new;
end $fn$;
revoke all on function private.revoke_calendar_feed_on_membership() from public,anon,authenticated;
create trigger essential_calendar_member_revoke
after update of status,role or delete on public.company_members for each row
 execute function private.revoke_calendar_feed_on_membership();

create function private.revoke_calendar_feed_on_worker()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if tg_op='DELETE' then
  update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
   where company_id=old.company_id and worker_id=old.id and revoked_at is null;
  return old;
 end if;
 if new.auth_user_id is distinct from old.auth_user_id or new.status is distinct from old.status
    or new.personal_access is distinct from old.personal_access then
  update private.essential_calendar_feed_tokens set revoked_at=clock_timestamp()
   where company_id=new.company_id and worker_id=new.id and revoked_at is null;
 end if;
 return new;
end $fn$;
revoke all on function private.revoke_calendar_feed_on_worker() from public,anon,authenticated;
create trigger essential_calendar_worker_revoke
after update of status,personal_access,auth_user_id or delete on public.company_workers for each row
 execute function private.revoke_calendar_feed_on_worker();

revoke all on function public.personal_calendar_feed_status(uuid),
 public.personal_calendar_feed_rotate(uuid),public.personal_calendar_feed_revoke(uuid),
 public.personal_calendar_feed_read(text) from public,anon,authenticated;
grant execute on function public.personal_calendar_feed_status(uuid),
 public.personal_calendar_feed_rotate(uuid),public.personal_calendar_feed_revoke(uuid)
 to authenticated;
grant execute on function public.personal_calendar_feed_read(text) to service_role;
