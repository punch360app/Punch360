-- PUNCH-PLATFORM-003 | three Super Admin accounts (one immutable root + two delegated).
-- No account is promoted by this migration. Current root binding is preserved.
-- Uses the SAME server-authoritative private.platform_owner membership read by
-- legacy RLS and service functions. Never use JWT app_metadata for platform rights.
do $$
begin
 if (select count(*) from private.platform_owner) <> 1 then
  raise exception 'Exactly one existing platform root is required before migration';
 end if;
end $$;

alter table private.platform_owner
 add column owner_role text not null default 'delegate'
 check (owner_role in ('root','delegate'));
update private.platform_owner set owner_role='root';
alter table private.platform_owner drop constraint platform_owner_pkey;
alter table private.platform_owner drop constraint platform_owner_singleton_check;
alter table private.platform_owner drop column singleton;
alter table private.platform_owner add constraint platform_owner_pkey primary key (user_id);
create unique index platform_owner_single_root on private.platform_owner(owner_role)
 where owner_role='root';

-- MAX THREE checked inside a serializing transaction; only root can modify.
-- The existing root is neither removable nor replaceable by these RPCs.
create function public.platform_admin_members()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 perform private.assert_platform_owner();
 select jsonb_build_object(
  'max',3,
  'count',(select count(*) from private.platform_owner),
  'is_root',exists(select 1 from private.platform_owner
                   where user_id=auth.uid() and owner_role='root'),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
     'id',p.user_id,'email',u.email,'role',p.owner_role,
     'bound_at',p.bound_at,'email_confirmed',u.email_confirmed_at is not null,
     'mfa_ready',exists(select 1 from auth.mfa_factors f
       where f.user_id=p.user_id and f.status='verified'))
     order by case when p.owner_role='root' then 0 else 1 end,p.bound_at)
     from private.platform_owner p join auth.users u on u.id=p.user_id),'[]'::jsonb)
 ) into v;
 return v;
end $$;

create function public.platform_admin_add(p_email text,p_confirmation text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user auth.users%rowtype;v_email text;v_count integer;
begin
 perform private.assert_platform_owner(); -- live Auth session + verified MFA (aal2)
 if not exists(select 1 from private.platform_owner p
               where p.user_id=auth.uid() and p.owner_role='root') then
  raise exception using errcode='42501',message='Seul le propriétaire principal peut autoriser un Super Admin';
 end if;
 v_email:=lower(trim(coalesce(p_email,'')));
 if length(v_email)<6 or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Courriel invalide';
 end if;
 if p_confirmation is distinct from 'AJOUTER '||v_email then
  raise exception 'Confirmation exacte requise : AJOUTER suivi du courriel';
 end if;
 if length(trim(coalesce(p_reason,''))) not between 8 and 500 then
  raise exception 'Motif requis (8 à 500 caractères)';
 end if;
 -- Serialize concurrent grants, including both sessions from the same root.
 lock table private.platform_owner in share row exclusive mode;
 select count(*) into v_count from private.platform_owner;
 if v_count >= 3 then raise exception 'Maximum de trois Super Admins atteint';end if;
 select * into v_user from auth.users u where lower(u.email)=v_email;
 if not found or v_user.email_confirmed_at is null or v_user.deleted_at is not null
    or (v_user.banned_until is not null and v_user.banned_until>clock_timestamp()) then
  raise exception 'Compte inexistant, courriel non confirmé ou compte désactivé';
 end if;
 if exists(select 1 from private.platform_owner where user_id=v_user.id) then
  raise exception 'Ce compte est déjà Super Admin';
 end if;
 if exists(select 1 from private.test_accounts where user_id=v_user.id) then
  raise exception 'Un compte de test ne peut pas devenir Super Admin';
 end if;
 insert into private.platform_owner(user_id,confirmed_email_at_binding,owner_role)
 values(v_user.id,v_user.email,'delegate');
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'platform_admin_added',v_user.id,
        jsonb_build_object('role','delegate','reason',trim(p_reason),'count_after',v_count+1));
 return public.platform_admin_members();
end $$;

create function public.platform_admin_remove(p_user uuid,p_confirmation text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target private.platform_owner%rowtype;v_email text;
begin
 perform private.assert_platform_owner();
 if not exists(select 1 from private.platform_owner p
               where p.user_id=auth.uid() and p.owner_role='root') then
  raise exception using errcode='42501',message='Seul le propriétaire principal peut révoquer un Super Admin';
 end if;
 if length(trim(coalesce(p_reason,''))) not between 8 and 500 then
  raise exception 'Motif requis (8 à 500 caractères)';
 end if;
 lock table private.platform_owner in share row exclusive mode;
 select * into v_target from private.platform_owner where user_id=p_user for update;
 if not found then raise exception 'Super Admin introuvable';end if;
 if v_target.owner_role='root' then
  raise exception using errcode='42501',message='Le propriétaire principal ne peut pas être révoqué';
 end if;
 select lower(email) into v_email from auth.users where id=p_user;
 if p_confirmation is distinct from 'RETIRER '||v_email then
  raise exception 'Confirmation exacte requise : RETIRER suivi du courriel';
 end if;
 delete from private.platform_owner where user_id=p_user and owner_role='delegate';
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'platform_admin_removed',p_user,
        jsonb_build_object('role','delegate','reason',trim(p_reason)));
 return public.platform_admin_members();
end $$;

revoke all on function public.platform_admin_members(),
 public.platform_admin_add(text,text,text),
 public.platform_admin_remove(uuid,text,text) from public,anon;
grant execute on function public.platform_admin_members(),
 public.platform_admin_add(text,text,text),
 public.platform_admin_remove(uuid,text,text) to authenticated;

comment on table private.platform_owner is
 'PUNCH Super Admin role authority: one original root and up to two delegates. Service-side checks always read this table; no mutable JWT role claim.';
