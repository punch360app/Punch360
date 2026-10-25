-- A company archive contains business records, never login or device credentials.
create table private.company_archive_keys(id uuid primary key default gen_random_uuid(),secret_id uuid not null,created_at timestamptz not null default now());
alter table private.company_archive_keys enable row level security;
revoke all on private.company_archive_keys from public,anon,authenticated;
insert into private.company_archive_keys(secret_id) select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'punch-company-archive-signing','Company data archive authenticity key');
create table private.company_exports (
 id uuid primary key,company_id uuid not null references public.companies(id),actor_id uuid not null,kind text not null check(kind in('export','import')),
 payload_text text not null,sha256 text not null,signature text not null,key_id uuid not null references private.company_archive_keys(id),manifest jsonb not null,
 reason text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours'
);
alter table private.company_exports enable row level security;
revoke all on private.company_exports from public,anon,authenticated;
create index company_exports_actor on private.company_exports(actor_id,created_at desc);
create index company_exports_expiry on private.company_exports(expires_at);
create function private.assert_company_archive_access(p_company uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.platform_owner where user_id=auth.uid()) then perform private.assert_live_platform_session();
 elsif not exists(select 1 from public.company_members m join auth.users u on u.id=m.user_id join auth.sessions s on s.user_id=u.id where m.company_id=p_company and m.user_id=auth.uid() and m.role='boss' and m.status='active' and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp()) and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>clock_timestamp())) then raise exception using errcode='42501',message='Boss avec session active ou Super Admin MFA requis';end if;
 if not exists(select 1 from public.companies where id=p_company) then raise exception 'Entreprise inaccessible';end if;
end $$;
revoke all on function private.assert_company_archive_access(uuid) from public,anon,authenticated;
create function private.company_archive_sign(p_key uuid,p_message text) returns text language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 select d.decrypted_secret into secret from private.company_archive_keys k join vault.decrypted_secrets d on d.id=k.secret_id where k.id=p_key;
 if secret is null then raise exception 'Clé d’archive indisponible';end if;return encode(extensions.hmac(p_message,secret,'sha256'),'hex');
end $$;
revoke all on function private.company_archive_sign(uuid,text) from public,anon,authenticated;
