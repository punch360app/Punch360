create table private.worker_invitations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,worker_id uuid not null,
 token_hash bytea not null unique,email text,phone text,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid,revoked_at timestamptz,
 sms_status text not null default 'ready' check(sms_status in ('ready','sending','sent','delivered','failed','undelivered','unknown')),
 provider_message_id text unique,send_attempted_at timestamptz,
 foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create index worker_invites_company_time on private.worker_invitations(company_id,created_at);
alter table private.worker_invitations enable row level security;
revoke all on private.worker_invitations from public,anon,authenticated;
create function public.create_worker_invitation(p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workers;token text;inv uuid;hours integer:=72;
begin
 select * into w from public.company_workers where id=p_worker;
 if not found or not private.can_administer(w.company_id) then raise exception using errcode='42501',message='Gestionnaire autorisé requis';end if;
 perform 1 from public.companies where id=w.company_id for update;
 select * into w from public.company_workers where id=p_worker for update;
 if w.auth_user_id is not null or w.status<>'active' or not w.personal_access then raise exception 'Compte déjà lié ou accès personnel désactivé';end if;
 if w.email is null and w.phone is null then raise exception 'Ajouter un canal vérifiable avant une invitation personnelle';end if;
 if (select count(*) from private.worker_invitations where company_id=w.company_id and created_at>clock_timestamp()-interval '24 hours')>=50 or (select count(*) from private.worker_invitations where worker_id=w.id and created_at>clock_timestamp()-interval '1 hour')>=3 then raise exception 'Limite d’invitations atteinte. Réessayez plus tard.';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update private.worker_invitations set revoked_at=clock_timestamp() where worker_id=w.id and accepted_at is null and revoked_at is null;
 insert into private.worker_invitations(company_id,worker_id,token_hash,email,phone,created_by,expires_at)
 values(w.company_id,w.id,sha256(convert_to(token,'UTF8')),w.email,w.phone,auth.uid(),clock_timestamp()+make_interval(hours=>hours)) returning id into inv;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(w.company_id,auth.uid(),'worker_invited',w.id,jsonb_build_object('invitation_id',inv),'Invitation au dossier existant, sans siège supplémentaire');
 return jsonb_build_object('id',inv,'token',token,'expires_in_hours',hours,'worker_id',w.id);
end $$;
create function public.accept_worker_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i private.worker_invitations;w public.company_workers;u auth.users;
begin
 if auth.uid() is null or p_token is null or length(p_token)<>64 then raise exception 'Invitation invalide';end if;
 select * into i from private.worker_invitations where token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then raise exception 'Invitation invalide';end if;
 perform 1 from public.companies where id=i.company_id for update;
 select * into i from private.worker_invitations where id=i.id for update;
 select * into w from public.company_workers where id=i.worker_id for update;
 if i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=clock_timestamp() or w.auth_user_id is not null or w.status<>'active' or not w.personal_access then raise exception 'Invitation expirée, utilisée ou annulée';end if;
 select * into u from auth.users where id=auth.uid();
 if not ((i.email is not null and u.email_confirmed_at is not null and lower(u.email)=i.email) or (i.phone is not null and u.phone_confirmed_at is not null and '+'||ltrim(u.phone,'+')=i.phone)) then raise exception 'Confirmez le courriel ou téléphone du destinataire invité';end if;
 if exists(select 1 from public.company_members where company_id=i.company_id and user_id=auth.uid()) or exists(select 1 from public.company_workers where company_id=i.company_id and auth_user_id=auth.uid()) then raise exception 'Un compte de cette compagnie est déjà associé';end if;
 -- Link the stable record BEFORE membership trigger, which reuses it through its unique auth binding.
 update public.company_workers set auth_user_id=auth.uid() where id=w.id;
 insert into public.company_members(company_id,user_id,role,status) values(w.company_id,auth.uid(),w.role,'active');
 update private.worker_invitations set accepted_at=clock_timestamp(),accepted_by=auth.uid() where id=i.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(w.company_id,auth.uid(),'worker_account_linked',w.id,jsonb_build_object('invitation_id',i.id),'Rattachement au dossier salarié existant');
 return w.company_id;
end $$;
create function public.worker_invitation_sms_claim(p_actor uuid,p_invitation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.worker_invitations;w public.company_workers;c public.companies;
begin
 select * into i from private.worker_invitations where id=p_invitation for update;
 if not found or i.created_by is distinct from p_actor or i.sms_status<>'ready' or i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=clock_timestamp() then raise exception 'Envoi indisponible';end if;
 select * into c from public.companies where id=i.company_id;
 select * into w from public.company_workers where id=i.worker_id;
 if c.is_test or c.billing_mode<>'production' or c.billing_status not in ('active','grace') or w.sms_consent_at is null or w.phone is distinct from i.phone or i.phone is null or not exists(select 1 from public.company_members where company_id=c.id and user_id=p_actor and status='active' and role in ('admin','boss')) then raise exception 'Envoi SMS non autorisé';end if;
 update private.worker_invitations set sms_status='sending',send_attempted_at=clock_timestamp() where id=i.id;
 return jsonb_build_object('to',i.phone,'first_name',w.first_name,'company_name',c.name);
end $$;
create function public.worker_invitation_sms_result(p_invitation uuid,p_status text,p_message text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','failed','unknown') or p_status is null then raise exception 'État invalide';end if;
 update private.worker_invitations set sms_status=p_status,provider_message_id=p_message where id=p_invitation and sms_status='sending';
end $$;
create function public.worker_invitation_sms_callback(p_message text,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','delivered','undelivered','failed') or p_status is null then return;end if;
 update private.worker_invitations set sms_status=p_status where provider_message_id=p_message and sms_status in ('sending','sent','unknown');
end $$;
create function public.worker_invitation_status(p_worker uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workers;
begin
 select * into w from public.company_workers where id=p_worker;
 if not found or not private.is_manager(w.company_id) then raise exception using errcode='42501',message='Accès refusé';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'created_at',i.created_at,'expires_at',i.expires_at,'sms_status',i.sms_status,'activated',i.accepted_at is not null,'revoked',i.revoked_at is not null)) from private.worker_invitations i where worker_id=w.id),'[]'::jsonb);
end $$;
revoke all on function public.create_worker_invitation(uuid),public.accept_worker_invitation(text),public.worker_invitation_status(uuid) from public,anon;
grant execute on function public.create_worker_invitation(uuid),public.accept_worker_invitation(text),public.worker_invitation_status(uuid) to authenticated;
revoke all on function public.worker_invitation_sms_claim(uuid,uuid),public.worker_invitation_sms_result(uuid,text,text),public.worker_invitation_sms_callback(text,text) from public,anon,authenticated;
grant execute on function public.worker_invitation_sms_claim(uuid,uuid),public.worker_invitation_sms_result(uuid,text,text),public.worker_invitation_sms_callback(text,text) to service_role;
