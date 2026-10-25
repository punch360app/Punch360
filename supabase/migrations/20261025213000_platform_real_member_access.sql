-- Super Admin: per-company intervention on a real Essential member.
-- Does NOT ban an Auth user globally, alter Stripe, delete records or expose credentials.
-- Run only on the exclusive PUNCH Supabase project mlabstdxxwjdpfaxiwmg.
create table private.platform_member_access_controls (
 company_id uuid not null references public.companies(id),
 user_id uuid not null references auth.users(id),
 version integer not null default 1 check(version>=1),
 suspended boolean not null,
 saved_role text not null,
 saved_worker_id uuid,
 saved_mobile boolean,
 saved_kiosk boolean,
 saved_personal boolean,
 updated_by uuid not null,
 updated_at timestamptz not null default clock_timestamp(),
 reason text not null check (length(trim(reason)) between 8 and 1000),
 primary key (company_id,user_id)
);
alter table private.platform_member_access_controls enable row level security;
revoke all on private.platform_member_access_controls from public,anon,authenticated;

create function public.platform_member_access_preview(
 p_company uuid,p_user uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.companies; m public.company_members; row_controls private.platform_member_access_controls;
 worker_count integer; punch_count integer; other_boss integer; worker public.company_workers;
begin
 perform private.assert_live_platform_session();
 if length(trim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception using errcode='22023',message='Motif détaillé requis (8 caractères minimum)';end if;
 select * into c from public.companies where id=p_company;
 if not found or c.product_edition<>'essential' or c.is_test then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 if p_user=auth.uid() or exists(select 1 from private.platform_owner where user_id=p_user)
  or exists(select 1 from private.test_accounts where user_id=p_user)
  or not exists(select 1 from auth.users where id=p_user and deleted_at is null)
  then raise exception using errcode='42501',message='Utilisateur cible non admissible';end if;
 select * into m from public.company_members where company_id=p_company and user_id=p_user;
 if not found or m.role='boss' then raise exception using errcode='42501',message='Un membre non-Boss de cette entreprise est requis';end if;
 select * into row_controls from private.platform_member_access_controls where company_id=p_company and user_id=p_user;
 select count(*) into worker_count from public.company_workers where company_id=p_company and auth_user_id=p_user;
 select * into worker from public.company_workers where company_id=p_company and auth_user_id=p_user order by created_at,id limit 1;
 select count(*) into punch_count from public.punch_sessions where company_id=p_company and user_id=p_user and ended_at is null;
 select count(*) into other_boss from public.company_members where company_id=p_company and role='boss' and status='active' and user_id<>p_user;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'real_member_access_preview',p_user,
 jsonb_build_object('company_id',p_company,'reason',trim(p_reason),'version',coalesce(row_controls.version,0)));
 return jsonb_build_object('company_id',p_company,'user_id',p_user,'role',m.role,'member_status',m.status,
 'suspended',coalesce(row_controls.suspended,false),'version',coalesce(row_controls.version,0),
 'active_punch',punch_count>0,'worker_count',worker_count,'worker_status',worker.status,
 'other_active_bosses',other_boss,'scope','company_only',
 'can_suspend',m.status='active' and coalesce(row_controls.suspended,false)=false and worker_count<=1 and punch_count=0 and other_boss>0,
 'can_restore',m.status='disabled' and coalesce(row_controls.suspended,false) and row_controls.saved_role=m.role
  and worker_count<=1 and worker.id is not distinct from row_controls.saved_worker_id
  and (worker.id is null or (worker.personal_access=false and worker.can_mobile_punch=false and worker.can_kiosk_punch=false)));
end $$;

create function public.platform_member_access_change(
 p_company uuid,p_user uuid,p_action text,p_expected_version integer,p_confirmation text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.companies;m public.company_members;old private.platform_member_access_controls;
 worker public.company_workers;result private.platform_member_access_controls;worker_count integer;
begin
 perform private.assert_live_platform_session();
 if p_action not in ('suspend','restore') or p_action is null
    or length(trim(coalesce(p_reason,''))) not between 8 and 1000
    or p_confirmation is distinct from p_user::text||':'||p_company::text
    or p_expected_version is null or p_expected_version<0
 then raise exception using errcode='22023',message='Action, motif, version et confirmation exacte requis';end if;
 select * into c from public.companies where id=p_company for update;
 if not found or c.product_edition<>'essential' or c.is_test
 then raise exception using errcode='42501',message='Entreprise Essentiel réelle requise';end if;
 if p_user=auth.uid() or exists(select 1 from private.platform_owner where user_id=p_user)
    or exists(select 1 from private.test_accounts where user_id=p_user)
    or not exists(select 1 from auth.users where id=p_user and deleted_at is null)
 then raise exception using errcode='42501',message='Utilisateur cible non admissible';end if;
 select * into m from public.company_members where company_id=p_company and user_id=p_user for update;
 if not found or m.role='boss' then raise exception using errcode='42501',message='Compte Boss exclu de cette intervention';end if;
 if not exists(select 1 from public.company_members where company_id=p_company and role='boss' and status='active' and user_id<>p_user)
 then raise exception using errcode='42501',message='Aucun autre Boss actif : intervention refusée';end if;
 select count(*) into worker_count from public.company_workers where company_id=p_company and auth_user_id=p_user;
 if worker_count>1 then raise exception using errcode='22023',message='Plusieurs dossiers salariés : réconciliation manuelle requise';end if;
 select * into worker from public.company_workers where company_id=p_company and auth_user_id=p_user for update;
 select * into old from private.platform_member_access_controls where company_id=p_company and user_id=p_user for update;
 if coalesce(old.version,0)<>p_expected_version then
 raise exception using errcode='40001',message='État modifié : relire la fiche avant de confirmer';end if;
 if p_action='suspend' then
   if m.status<>'active' or coalesce(old.suspended,false) then raise exception using errcode='22023',message='Accès non actif ou déjà suspendu';end if;
   if exists(select 1 from public.punch_sessions where company_id=p_company and user_id=p_user and ended_at is null)
   then raise exception using errcode='22023',message='Fermer le pointage actif avant suspension';end if;
   update public.company_members set status='disabled' where company_id=p_company and user_id=p_user;
   if worker.id is not null then
    update public.company_workers set can_mobile_punch=false,can_kiosk_punch=false,personal_access=false where id=worker.id;
   end if;
   insert into private.platform_member_access_controls
    (company_id,user_id,version,suspended,saved_role,saved_worker_id,saved_mobile,saved_kiosk,saved_personal,updated_by,reason)
   values(p_company,p_user,coalesce(old.version,0)+1,true,m.role,worker.id,worker.can_mobile_punch,worker.can_kiosk_punch,worker.personal_access,auth.uid(),trim(p_reason))
   on conflict(company_id,user_id) do update set
    version=excluded.version,suspended=true,saved_role=excluded.saved_role,saved_worker_id=excluded.saved_worker_id,
    saved_mobile=excluded.saved_mobile,saved_kiosk=excluded.saved_kiosk,saved_personal=excluded.saved_personal,
    updated_by=excluded.updated_by,updated_at=clock_timestamp(),reason=excluded.reason returning * into result;
 else
   if not coalesce(old.suspended,false) or m.status<>'disabled' or m.role is distinct from old.saved_role
   then raise exception using errcode='22023',message='Rétablissement impossible : état ou rôle modifié';end if;
   if worker.id is distinct from old.saved_worker_id
   then raise exception using errcode='22023',message='Dossier salarié modifié : vérification manuelle requise';end if;
   if worker.id is not null and
    (worker.personal_access or worker.can_mobile_punch or worker.can_kiosk_punch or worker.status<>'active')
   then raise exception using errcode='22023',message='Dossier salarié modifié ou inactif : rétablissement automatique refusé';end if;
   update public.company_members set status='active' where company_id=p_company and user_id=p_user;
   if worker.id is not null then
    update public.company_workers set can_mobile_punch=old.saved_mobile,
      can_kiosk_punch=old.saved_kiosk,personal_access=old.saved_personal where id=worker.id;
   end if;
   update private.platform_member_access_controls set suspended=false,version=old.version+1,
     updated_by=auth.uid(),updated_at=clock_timestamp(),reason=trim(p_reason)
    where company_id=p_company and user_id=p_user returning * into result;
 end if;
 insert into private.platform_audit(actor_id,action,entity_id,detail)
 values(auth.uid(),'real_member_access_'||p_action,p_user,
 jsonb_build_object('company_id',p_company,'reason',trim(p_reason),'version_before',coalesce(old.version,0),
 'version_after',result.version,'scope','company_only','preserves_history',true));
 return jsonb_build_object('company_id',p_company,'user_id',p_user,'suspended',result.suspended,
   'version',result.version,'scope','company_only','role',m.role,'member_status',case when result.suspended then 'disabled' else 'active' end);
end $$;

revoke all on function public.platform_member_access_preview(uuid,uuid,text),
 public.platform_member_access_change(uuid,uuid,text,integer,text,text) from public,anon;
grant execute on function public.platform_member_access_preview(uuid,uuid,text),
 public.platform_member_access_change(uuid,uuid,text,integer,text,text) to authenticated;
