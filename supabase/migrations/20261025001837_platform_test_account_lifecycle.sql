-- Confirm a live MFA session for credential access and account destruction.
create function private.assert_live_platform_session() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_platform_owner();
 if not exists(select 1 from auth.sessions where id::text=auth.jwt()->>'session_id' and user_id=auth.uid() and aal='aal2' and (not_after is null or not_after>clock_timestamp())) then raise exception using errcode='42501',message='Session MFA expirée : se reconnecter';end if;
end $$;
revoke all on function private.assert_live_platform_session() from public,anon,authenticated;
create function public.platform_test_access() returns boolean language plpgsql security definer set search_path='' as $$
begin perform private.assert_live_platform_session();return true;end $$;
revoke all on function public.platform_test_access() from public,anon;grant execute on function public.platform_test_access() to authenticated;

-- Test identities only. No credential escrow for real employees.
alter table private.test_accounts add column deleted_at timestamptz,add column credential_secret_id uuid,add column credential_updated_at timestamptz;
create table private.test_account_actions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references private.test_accounts(user_id),
 actor_id uuid not null,kind text not null check(kind in ('reset_password','delete')),
 secret_id uuid,reason text not null,status text not null default 'pending' check(status in ('pending','done','expired')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '5 minutes'
);
alter table private.test_account_actions enable row level security;
revoke all on private.test_account_actions from public,anon,authenticated;
create index test_actions_target on private.test_account_actions(user_id,status,created_at desc);

create function private.assert_isolated_test_account(p_user uuid,p_allow_deleting boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare t private.test_accounts;u auth.users;
begin
 select * into t from private.test_accounts where user_id=p_user for update;
 select * into u from auth.users where id=p_user;
 if t.user_id is null or t.deleted_at is not null or u.id is null or u.deleted_at is not null or (u.email is null or u.email not like '%@punch360.test.invalid') or exists(select 1 from private.platform_owner where user_id=p_user) or not exists(select 1 from public.companies where id=t.company_id and is_test and billing_mode='test_simulated') or exists(select 1 from public.company_members where user_id=p_user and company_id<>t.company_id) or exists(select 1 from public.company_workers where auth_user_id=p_user and company_id<>t.company_id) or exists(select 1 from public.punch_sessions where user_id=p_user and company_id<>t.company_id) then raise exception using errcode='42501',message='Identité test isolée obligatoire';end if;
 if not p_allow_deleting and exists(select 1 from private.test_account_actions where user_id=p_user and kind='delete' and status='pending') then raise exception 'Suppression en cours : réessayer la suppression';end if;
 return t.company_id;
end $$;
revoke all on function private.assert_isolated_test_account(uuid,boolean) from public,anon,authenticated;

-- Service-only: verifies the provider hash before saving a generated credential.
create function public.platform_record_test_password(p_actor uuid,p_user uuid,p_password text) returns void language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception using errcode='42501',message='Acteur refusé';end if;
 perform private.assert_isolated_test_account(p_user);
 if length(coalesce(p_password,''))<24 or not exists(select 1 from auth.users where id=p_user and extensions.crypt(p_password,encrypted_password)=encrypted_password) then raise exception 'Mot de passe Auth non confirmé';end if;
 select credential_secret_id into secret_id from private.test_accounts where user_id=p_user;
 if secret_id is null then secret_id:=vault.create_secret(p_password,'punch-test-'||p_user::text,'Credential for isolated PUNCH test identity');else perform vault.update_secret(secret_id,p_password);end if;
 update private.test_accounts set credential_secret_id=secret_id,credential_updated_at=clock_timestamp() where user_id=p_user;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'test_password_stored',p_user,'{}');
end $$;

create function public.platform_begin_test_action(p_user uuid,p_action text,p_reason text,p_confirmation text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;a private.test_account_actions;candidate uuid;
begin
 perform private.assert_live_platform_session();
 if p_action not in ('reset_password','delete') or p_action is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Action et motif requis';end if;
 -- Resume completion after Auth accepted a soft delete but the final RPC failed.
 if p_action='delete' then
  select x.* into a from private.test_account_actions x join private.test_accounts t on t.user_id=x.user_id join public.companies co on co.id=t.company_id join auth.users u on u.id=t.user_id where x.user_id=p_user and x.actor_id=auth.uid() and x.kind='delete' and x.status='pending' and t.deleted_at is null and co.is_test and co.billing_mode='test_simulated' and u.deleted_at is not null and not exists(select 1 from public.company_members m where m.user_id=t.user_id and m.company_id<>t.company_id);
  if found then return a.id;end if;
 end if;
 c:=private.assert_isolated_test_account(p_user,p_action='delete');
 if p_action='delete' and p_confirmation is distinct from (select email from auth.users where id=p_user) then raise exception 'Retaper le courriel test pour confirmer';end if;
 select * into a from private.test_account_actions where user_id=p_user and status='pending' order by created_at desc limit 1 for update;
 if found then
  if a.kind='delete' or a.expires_at>clock_timestamp() then
   if a.kind<>p_action or a.actor_id<>auth.uid() then raise exception 'Une autre opération reste en attente';end if;
   return a.id;
  end if;
  if a.secret_id is not null then delete from vault.secrets where id=a.secret_id;end if;
  update private.test_account_actions set status='expired',secret_id=null where id=a.id;
 end if;
 if p_action='delete' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c::text||p_user::text,0));
  if exists(select 1 from public.punch_sessions where company_id=c and user_id=p_user and ended_at is null) then raise exception 'Terminer le punch de test avant suppression';end if;
  update public.company_members set status='disabled' where company_id=c and user_id=p_user;
  update public.company_workers set status='disabled',personal_access=false,can_mobile_punch=false,can_kiosk_punch=false where company_id=c and auth_user_id=p_user;
 else
  candidate:=vault.create_secret(encode(extensions.gen_random_bytes(32),'hex')||'Aa9!',null,'Pending isolated PUNCH test password');
 end if;
 insert into private.test_account_actions(user_id,actor_id,kind,secret_id,reason) values(p_user,auth.uid(),p_action,candidate,trim(p_reason)) returning * into a;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'test_'||p_action||'_requested',p_user,jsonb_build_object('operation',a.id,'reason',trim(p_reason)));
 return a.id;
end $$;

-- Edge only, after verifying the initiating user's MFA. Never grant to clients.
create function public.platform_test_action_payload(p_actor uuid,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.test_account_actions;password text;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception using errcode='42501',message='Acteur refusé';end if;
 select * into a from private.test_account_actions where id=p_operation and actor_id=p_actor;
 if not found then raise exception 'Opération inconnue';end if;
 perform 1 from private.test_accounts where user_id=a.user_id for update;
 select * into a from private.test_account_actions where id=p_operation and actor_id=p_actor for update;
 if not found or a.status<>'pending' or (a.kind<>'delete' and a.expires_at<clock_timestamp()) then raise exception 'Opération expirée ou terminée';end if;
 -- A soft-deleted identity is only allowed here to finish its interrupted deletion.
 if a.kind='delete' and exists(select 1 from auth.users where id=a.user_id and deleted_at is not null) then
  if not exists(select 1 from private.test_accounts t join public.companies c on c.id=t.company_id where t.user_id=a.user_id and t.deleted_at is null and c.is_test and c.billing_mode='test_simulated') or exists(select 1 from public.company_members m join private.test_accounts t on t.user_id=m.user_id where m.user_id=a.user_id and m.company_id<>t.company_id) then raise exception 'Compte test requis';end if;
 else perform private.assert_isolated_test_account(a.user_id,a.kind='delete');end if;
 if a.kind='reset_password' then select decrypted_secret into password from vault.decrypted_secrets where id=a.secret_id;if password is null then raise exception 'Secret provisoire indisponible';end if;end if;
 return jsonb_build_object('user_id',a.user_id,'kind',a.kind,'password',password);
end $$;

create function public.platform_complete_test_action(p_actor uuid,p_operation uuid) returns void language plpgsql security definer set search_path='' as $$
declare a private.test_account_actions;password text;previous uuid;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) then raise exception using errcode='42501',message='Acteur refusé';end if;
 select * into a from private.test_account_actions where id=p_operation and actor_id=p_actor;
 if not found then raise exception 'Opération inconnue';end if;
 perform 1 from private.test_accounts where user_id=a.user_id for update;
 select * into a from private.test_account_actions where id=p_operation and actor_id=p_actor for update;
 if not found then raise exception 'Opération inconnue';end if;if a.status='done' then return;end if;if a.status<>'pending' then raise exception 'Opération expirée';end if;
 perform 1 from private.test_accounts where user_id=a.user_id for update;
 if a.kind='reset_password' then
  perform private.assert_isolated_test_account(a.user_id);
  select decrypted_secret into password from vault.decrypted_secrets where id=a.secret_id;
  if password is null or not exists(select 1 from auth.users where id=a.user_id and extensions.crypt(password,encrypted_password)=encrypted_password) then raise exception 'Nouveau mot de passe non confirmé par Auth';end if;
  select credential_secret_id into previous from private.test_accounts where user_id=a.user_id;
  if previous is not null then delete from vault.secrets where id=previous;end if;
  update private.test_accounts set credential_secret_id=a.secret_id,credential_updated_at=clock_timestamp() where user_id=a.user_id;
 else
  if not exists(select 1 from auth.users where id=a.user_id and deleted_at is not null) then raise exception 'Suppression Auth non confirmée';end if;
  if not exists(select 1 from private.test_accounts t join public.companies c on c.id=t.company_id where t.user_id=a.user_id and c.is_test and c.billing_mode='test_simulated') or exists(select 1 from public.company_members m join private.test_accounts t on t.user_id=m.user_id where m.user_id=a.user_id and m.company_id<>t.company_id) then raise exception 'Compte test isolé requis';end if;
  delete from vault.secrets where id in(select credential_secret_id from private.test_accounts where user_id=a.user_id union select secret_id from private.test_account_actions where user_id=a.user_id);
  update private.test_account_actions set secret_id=null where user_id=a.user_id;
  update private.test_accounts set deleted_at=clock_timestamp(),credential_secret_id=null where user_id=a.user_id;
 end if;
 update private.test_account_actions set status='done' where id=a.id;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'test_'||a.kind||'_completed',a.user_id,jsonb_build_object('operation',a.id));
end $$;

create function public.platform_reveal_test_password(p_user uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare password text;mail text;
begin
 perform private.assert_live_platform_session();perform private.assert_isolated_test_account(p_user);
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Motif requis';end if;
 select s.decrypted_secret into password from private.test_accounts t join vault.decrypted_secrets s on s.id=t.credential_secret_id where t.user_id=p_user;
 if password is null then raise exception 'Ancien mot de passe non conservé : réinitialiser ce compte test';end if;
 if not exists(select 1 from auth.users where id=p_user and extensions.crypt(password,encrypted_password)=encrypted_password) then raise exception 'Mot de passe modifié hors console : réinitialiser ce compte test';end if;
 select email into mail from auth.users where id=p_user;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'test_password_revealed',p_user,jsonb_build_object('reason',trim(p_reason)));
 return jsonb_build_object('user_id',p_user,'email',mail,'password',password);
end $$;

create or replace function public.platform_test_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_platform_owner();
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'company_id',t.company_id,'company_name',c.name,'edition',c.product_edition,'email',u.email,'role',m.role,'status',m.status,'password_available',t.credential_secret_id is not null,'credential_updated_at',t.credential_updated_at,'deleting',exists(select 1 from private.test_account_actions a where a.user_id=t.user_id and a.kind='delete' and a.status='pending'))) from private.test_accounts t join auth.users u on u.id=t.user_id join public.company_members m on m.user_id=t.user_id and m.company_id=t.company_id join public.companies c on c.id=t.company_id where t.deleted_at is null),'[]'::jsonb);
end $$;

create or replace function public.platform_test_account_status(p_actor uuid,p_user uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if not exists(select 1 from private.platform_owner where user_id=p_actor) or p_active is null then raise exception using errcode='42501',message='Acteur ou statut refusé';end if;
 c:=private.assert_isolated_test_account(p_user);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c::text||p_user::text,0));
 if not p_active and exists(select 1 from public.punch_sessions where user_id=p_user and ended_at is null) then raise exception 'Terminer le punch de test avant désactivation';end if;
 update public.company_members set status=case when p_active then 'active' else 'disabled' end where user_id=p_user and company_id=c;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'test_user_status',p_user,jsonb_build_object('active',p_active));
end $$;

revoke all on function public.platform_record_test_password(uuid,uuid,text),public.platform_test_action_payload(uuid,uuid),public.platform_complete_test_action(uuid,uuid),public.platform_test_account_status(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.platform_record_test_password(uuid,uuid,text),public.platform_test_action_payload(uuid,uuid),public.platform_complete_test_action(uuid,uuid),public.platform_test_account_status(uuid,uuid,boolean) to service_role;
revoke all on function public.platform_begin_test_action(uuid,text,text,text),public.platform_reveal_test_password(uuid,text) from public,anon;
grant execute on function public.platform_begin_test_action(uuid,text,text,text),public.platform_reveal_test_password(uuid,text) to authenticated;

-- Recheck worker authorization after waiting for the shared mobile/borne lock.
do $$
declare definition text;anchor text:='select * into s from public.punch_sessions where company_id=d.company_id and worker_id=w.id and ended_at is null for update;';
begin
 select pg_get_functiondef('public.kiosk_execute(uuid,text,text,text,text,uuid,text)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Kiosk authorization anchor missing';end if;
 execute replace(definition,anchor, E'if not exists(select 1 from public.company_workers where id=w.id and company_id=d.company_id and status=''active'' and can_kiosk_punch) then return jsonb_build_object(''ok'',false,''error'',''IDENTITY_DENIED'');end if;\n '||anchor);
end $$;

-- A registered test identity cannot become a production member between checks.
create function private.protect_test_identity_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;expected uuid;
begin
 if tg_table_name='company_workers' then uid:=new.auth_user_id;else uid:=new.user_id;end if;
 select company_id into expected from private.test_accounts where user_id=uid;
 if expected is not null and new.company_id<>expected then raise exception using errcode='42501',message='Un compte test ne peut rejoindre une autre compagnie';end if;return new;
end $$;
revoke all on function private.protect_test_identity_scope() from public,anon,authenticated;
create trigger test_member_scope before insert or update of user_id,company_id on public.company_members for each row execute function private.protect_test_identity_scope();
create trigger test_worker_scope before insert or update of auth_user_id,company_id on public.company_workers for each row execute function private.protect_test_identity_scope();
