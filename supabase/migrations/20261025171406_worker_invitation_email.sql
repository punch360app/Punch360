create table public.invitation_delivery_settings(
 company_id uuid primary key references public.companies(id),email_auto boolean not null default false,
 expires_hours integer not null default 72 check(expires_hours between 1 and 720),version integer not null default 1
);
alter table public.invitation_delivery_settings enable row level security;
create policy invitation_settings_read on public.invitation_delivery_settings for select to authenticated using(private.is_manager(company_id));
grant select on public.invitation_delivery_settings to authenticated;
revoke insert,update,delete on public.invitation_delivery_settings from anon,authenticated;
create function public.set_invitation_delivery_settings(p_company uuid,p_email_auto boolean,p_hours integer,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare settings public.invitation_delivery_settings;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if p_email_auto is null or p_hours is null or p_hours not between 1 and 720 then raise exception 'Paramètres invalides';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into settings from public.invitation_delivery_settings where company_id=p_company;
 if coalesce(settings.version,0) is distinct from p_expected_version then raise exception 'Paramètres modifiés : actualiser';end if;
 insert into public.invitation_delivery_settings(company_id,email_auto,expires_hours) values(p_company,p_email_auto,p_hours) on conflict(company_id) do update set email_auto=excluded.email_auto,expires_hours=excluded.expires_hours,version=invitation_delivery_settings.version+1;
 insert into public.workforce_audit(company_id,actor_id,action,before_value,after_value,reason) values(p_company,auth.uid(),'invitation_delivery_settings',to_jsonb(settings),jsonb_build_object('email_auto',p_email_auto,'expires_hours',p_hours),'Préférences d’invitations, aucun envoi immédiat');
end $$;
-- A new dedicated key; never reads or replaces the archive signing key.
do $$ begin
 if not exists(select 1 from vault.secrets where name='punch_invitation_email_key') then perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'punch_invitation_email_key','Encrypt transient invitation delivery tokens');end if;
end $$;
create function private.invitation_email_key() returns text language sql stable security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='punch_invitation_email_key'
$$;
revoke all on function private.invitation_email_key() from public,anon,authenticated;
create table private.worker_invitation_email(
 invitation_id uuid primary key references private.worker_invitations(id),company_id uuid not null references public.companies(id),
 recipient text not null,company_name text not null,encrypted_token bytea,
 status text not null default 'ready' check(status in('ready','retry','sending','sent','delivered','opened','failed','unknown','cancelled')),
 attempts integer not null default 0,lease uuid,claimed_at timestamptz,available_at timestamptz not null default now(),first_attempt_at timestamptz,
 provider_id text unique,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.worker_invitation_email enable row level security;
revoke all on private.worker_invitation_email from public,anon,authenticated;
create index worker_invitation_email_pending on private.worker_invitation_email(available_at) where status in('ready','retry');
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.create_worker_invitation(uuid)'::regprocedure);
 changed:=replace(source,'token:=encode(extensions.gen_random_bytes(32),''hex'');','select coalesce((select expires_hours from public.invitation_delivery_settings where company_id=w.company_id),72) into hours; token:=encode(extensions.gen_random_bytes(32),''hex'');');
 if changed=source then raise exception 'Invitation token source changed';end if;
 source:=changed;
 changed:=replace(source,'return jsonb_build_object(''id'',inv,',
 $new$if w.email is not null and exists(select 1 from public.invitation_delivery_settings where company_id=w.company_id and email_auto) then
 insert into private.worker_invitation_email(invitation_id,company_id,recipient,company_name,encrypted_token) select inv,w.company_id,w.email,c.name,extensions.pgp_sym_encrypt(token,private.invitation_email_key()) from public.companies c where c.id=w.company_id;
 end if;
 return jsonb_build_object('id',inv,$new$);
 if changed=source then raise exception 'Invitation return source changed';end if;execute changed;
end $migration$;
create function public.claim_invitation_email() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update private.worker_invitation_email set status='retry',available_at=clock_timestamp(),updated_at=clock_timestamp(),error_code='LeaseExpired' where status='sending' and claimed_at<clock_timestamp()-interval '5 minutes';
 update private.worker_invitation_email q set status='cancelled',encrypted_token=null,updated_at=clock_timestamp() from private.worker_invitations i,public.company_workers w where q.invitation_id=i.id and w.id=i.worker_id and q.status in('ready','retry','unknown') and
 (i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=clock_timestamp() or w.auth_user_id is not null or w.status<>'active' or not w.personal_access or w.email is distinct from q.recipient or not exists(select 1 from public.invitation_delivery_settings where company_id=i.company_id and email_auto));
 -- Provider deduplication expires at 24 h: never retry beyond a conservative 23 h window.
 update private.worker_invitation_email set status='unknown',encrypted_token=null,error_code='DeduplicationWindowExpired',updated_at=clock_timestamp() where status in('ready','retry') and first_attempt_at<clock_timestamp()-interval '23 hours';
 with candidates as(select invitation_id from private.worker_invitation_email where status in('ready','retry') and available_at<=clock_timestamp() and attempts<5 order by available_at for update skip locked limit 10),claimed as(
 update private.worker_invitation_email q set status='sending',lease=gen_random_uuid(),claimed_at=clock_timestamp(),first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1,updated_at=clock_timestamp() from candidates c where q.invitation_id=c.invitation_id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',q.invitation_id,'lease',q.lease,'to',q.recipient,'company_name',q.company_name,'token',extensions.pgp_sym_decrypt(q.encrypted_token,private.invitation_email_key()))),'[]') into result from claimed q;return result;
end $$;
create function public.finish_invitation_email(p_id uuid,p_lease uuid,p_status text,p_provider text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status is null or p_status not in('sent','retry','failed','unknown') or length(coalesce(p_provider,''))>200 or length(coalesce(p_error,''))>100 or (p_status='sent' and p_provider is null) then raise exception 'Résultat courriel invalide';end if;
 update private.worker_invitation_email set status=case when p_status='retry' and attempts>=5 then 'failed' else p_status end,provider_id=p_provider,error_code=p_error,encrypted_token=case when p_status in('sent','failed') or (p_status='retry' and attempts>=5) then null else encrypted_token end,available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),updated_at=clock_timestamp() where invitation_id=p_id and lease=p_lease and status='sending';
 if not found then raise exception 'Bail de courriel expiré';end if;
end $$;
create function public.worker_email_delivery_status(p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 select company_id into c from public.company_workers where id=p_worker;
 if c is null or not private.is_manager(c) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'created_at',i.created_at,'expires_at',i.expires_at,'email_status',coalesce(q.status,'not_requested'),'attempts',coalesce(q.attempts,0),'activated',i.accepted_at is not null,'revoked',i.revoked_at is not null,'expired',i.expires_at<=clock_timestamp()) order by i.created_at desc) from private.worker_invitations i left join private.worker_invitation_email q on q.invitation_id=i.id where i.worker_id=p_worker),'[]');
end $$;
revoke all on function public.set_invitation_delivery_settings(uuid,boolean,integer,integer),public.worker_email_delivery_status(uuid) from public,anon;
grant execute on function public.set_invitation_delivery_settings(uuid,boolean,integer,integer),public.worker_email_delivery_status(uuid) to authenticated;
revoke all on function public.claim_invitation_email(),public.finish_invitation_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_invitation_email(),public.finish_invitation_email(uuid,uuid,text,text,text) to service_role;
