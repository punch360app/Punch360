-- A verified Boss may voluntarily hand over an Essentiel company to an active
-- admin. No service-only unilateral takeover; all parties use live AAL2 sessions.
create table private.essential_boss_handoffs(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 from_user uuid not null references auth.users(id),
 to_user uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','completed','cancelled','expired')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '48 hours'),
 accepted_at timestamptz,
 accepted_session uuid,
 completed_at timestamptz,
 reason text not null check(length(btrim(reason)) between 8 and 1000),
 check(from_user<>to_user)
);
create unique index essential_boss_one_handoff_open
on private.essential_boss_handoffs(company_id) where status in ('pending','accepted');
alter table private.essential_boss_handoffs enable row level security;
revoke all on private.essential_boss_handoffs from public,anon,authenticated;

create function private.assert_live_boss_handoff_session(p_company uuid,p_boss boolean)
returns void language plpgsql security definer set search_path='' as $fn$
begin
 if auth.uid() is null or not exists(select 1 from auth.sessions s
  where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()
   and s.aal='aal2' and (s.not_after is null or s.not_after>clock_timestamp()))
 then raise exception using errcode='42501',message='MFA AAL2 et session valide obligatoires';end if;
 if not exists(select 1 from public.company_members m join public.companies c on c.id=m.company_id
  where c.id=p_company and c.product_edition='essential' and m.user_id=auth.uid()
  and m.status='active' and (not p_boss or m.role='boss'))
 then raise exception using errcode='42501',message='Appartenance ou rôle Boss Essentiel requis';end if;
end $fn$;
revoke all on function private.assert_live_boss_handoff_session(uuid,boolean) from public,anon,authenticated;

create function public.essential_boss_handoff_status(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare h private.essential_boss_handoffs;
begin
 perform private.assert_live_boss_handoff_session(p_company,false);
 select * into h from private.essential_boss_handoffs
 where company_id=p_company and status in ('pending','accepted')
 and (from_user=auth.uid() or to_user=auth.uid())
 order by created_at desc limit 1;
 if not found then return null;end if;
 return jsonb_build_object('id',h.id,'status',case when h.expires_at<=clock_timestamp() then 'expired' else h.status end,
 'version',h.version,'company_id',p_company,'from_user',h.from_user,'to_user',h.to_user,
 'created_at',h.created_at,'expires_at',h.expires_at,'accepted_at',h.accepted_at,
 'can_accept',h.to_user=auth.uid() and h.status='pending' and h.expires_at>clock_timestamp(),
 'can_complete',h.from_user=auth.uid() and h.status='accepted' and h.expires_at>clock_timestamp());
end $fn$;

create function public.essential_boss_handoff_request(
 p_company uuid,p_successor uuid,p_confirmation text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare record private.essential_boss_handoffs;
begin
 perform private.assert_live_boss_handoff_session(p_company,true);
 if p_successor is null or p_successor=auth.uid() or
 p_confirmation is distinct from p_company::text||':'||p_successor::text
 or length(btrim(coalesce(p_reason,''))) not between 8 and 1000
 then raise exception using errcode='22023',message='UUID et motif de transfert obligatoires';end if;
 perform 1 from public.companies where id=p_company and product_edition='essential' for update;
 if not found then raise exception using errcode='42501',message='Compagnie Essentiel requise';end if;
 if (select count(*) from public.company_members where company_id=p_company and role='boss' and status='active')<>1
 then raise exception using errcode='40001',message='Un Boss actif unique est requis avant une succession';end if;
 if not exists(select 1 from public.company_members where company_id=p_company
 and user_id=p_successor and role='admin' and status='active')
 then raise exception using errcode='42501',message='Successeur administrateur actif requis';end if;
 update private.essential_boss_handoffs set status='expired',version=version+1
 where company_id=p_company and status in ('pending','accepted') and expires_at<=clock_timestamp();
 if exists(select 1 from private.essential_boss_handoffs where company_id=p_company
 and status in('pending','accepted'))
 then raise exception using errcode='40001',message='Une demande de transfert est déjà active';end if;
 insert into private.essential_boss_handoffs(company_id,from_user,to_user,reason)
 values(p_company,auth.uid(),p_successor,btrim(p_reason)) returning * into record;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason,after_value)
 values(p_company,auth.uid(),'boss_handoff_requested',record.id,btrim(p_reason),
 jsonb_build_object('from_user',record.from_user,'to_user',record.to_user,'expiry',record.expires_at));
 return jsonb_build_object('id',record.id,'version',record.version,'status',record.status,
 'expires_at',record.expires_at,'company_id',p_company,'successor',p_successor);
end $fn$;

create function public.essential_boss_handoff_accept(
 p_company uuid,p_handoff uuid,p_expected_version integer,p_confirmation text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare h private.essential_boss_handoffs;
begin
 perform private.assert_live_boss_handoff_session(p_company,false);
 perform 1 from public.companies where id=p_company for update;
 select * into h from private.essential_boss_handoffs where id=p_handoff and company_id=p_company for update;
 if not found or h.to_user is distinct from auth.uid() or h.status<>'pending'
 or h.expires_at<=clock_timestamp() or h.version is distinct from p_expected_version
 or p_confirmation is distinct from p_company::text||':'||h.from_user::text
 then raise exception using errcode='42501',message='Demande invalide, expirée ou confirmation incorrecte';end if;
 if not exists(select 1 from public.company_members where company_id=p_company
 and user_id=h.from_user and role='boss' and status='active')
 or not exists(select 1 from public.company_members where company_id=p_company
 and user_id=h.to_user and role='admin' and status='active')
 then raise exception using errcode='40001',message='Rôles changés depuis la demande';end if;
 update private.essential_boss_handoffs set status='accepted',version=version+1,
 accepted_at=clock_timestamp(),accepted_session=(auth.jwt()->>'session_id')::uuid
 where id=h.id returning * into h;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'boss_handoff_accepted',h.id,'Successeur MFA a accepté');
 return jsonb_build_object('id',h.id,'status','accepted','version',h.version);
end $fn$;

create function public.essential_boss_handoff_complete(
 p_company uuid,p_handoff uuid,p_expected_version integer,p_confirmation text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare h private.essential_boss_handoffs;
begin
 perform private.assert_live_boss_handoff_session(p_company,true);
 perform 1 from public.companies where id=p_company and product_edition='essential' for update;
 if not found then raise exception using errcode='42501',message='Compagnie Essentiel requise';end if;
 select * into h from private.essential_boss_handoffs where id=p_handoff and company_id=p_company for update;
 if not found or h.from_user is distinct from auth.uid() or h.status<>'accepted'
 or h.expires_at<=clock_timestamp() or h.version is distinct from p_expected_version
 or p_confirmation is distinct from p_company::text||':'||h.to_user::text
 then raise exception using errcode='42501',message='Confirmation Boss expirée ou invalide';end if;
 if not exists(select 1 from auth.sessions where id=h.accepted_session
 and user_id=h.to_user and aal='aal2' and (not_after is null or not_after>clock_timestamp()))
 then raise exception using errcode='42501',message='Le successeur doit confirmer avec une session MFA vivante';end if;
 if (select count(*) from public.company_members where company_id=p_company and role='boss' and status='active')<>1
 then raise exception using errcode='40001',message='Plusieurs Boss actifs : transfert manuel requis';end if;
 if (select count(*) from public.company_members where company_id=p_company and status='active'
  and user_id in(h.from_user,h.to_user) and ((user_id=h.from_user and role='boss') or (user_id=h.to_user and role='admin')))<>2
 then raise exception using errcode='40001',message='Rôles ou comptes changés, recommencer le transfert';end if;
 update public.company_members set role='boss' where company_id=p_company and user_id=h.to_user
 and role='admin' and status='active';
 update public.company_members set role='admin' where company_id=p_company and user_id=h.from_user
 and role='boss' and status='active';
 update private.essential_boss_handoffs set status='completed',version=version+1,
 completed_at=clock_timestamp() where id=h.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason,before_value,after_value)
 values(p_company,auth.uid(),'boss_handoff_completed',h.id,'Transfert volontaire confirmé par les 2 sessions MFA',
 jsonb_build_object('old_boss',h.from_user,'old_admin',h.to_user),
 jsonb_build_object('new_boss',h.to_user,'new_admin',h.from_user));
 return jsonb_build_object('id',h.id,'status','completed','company_id',p_company,
 'new_boss',h.to_user,'old_boss',h.from_user);
end $fn$;

create function public.essential_boss_handoff_cancel(
 p_company uuid,p_handoff uuid,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare h private.essential_boss_handoffs;
begin
 perform private.assert_live_boss_handoff_session(p_company,false);
 perform 1 from public.companies where id=p_company for update;
 select * into h from private.essential_boss_handoffs where id=p_handoff and company_id=p_company for update;
 if not found or (auth.uid()<>h.from_user and auth.uid()<>h.to_user)
 or h.status not in('pending','accepted') or h.version<>p_expected_version
 then raise exception using errcode='42501',message='Annulation refusée ou version périmée';end if;
 update private.essential_boss_handoffs set status='cancelled',version=version+1 where id=h.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'boss_handoff_cancelled',h.id,'Demande de succession volontaire annulée');
 return jsonb_build_object('id',h.id,'status','cancelled');
end $fn$;

revoke all on function
 public.essential_boss_handoff_status(uuid),
 public.essential_boss_handoff_request(uuid,uuid,text,text),
 public.essential_boss_handoff_accept(uuid,uuid,integer,text),
 public.essential_boss_handoff_complete(uuid,uuid,integer,text),
 public.essential_boss_handoff_cancel(uuid,uuid,integer)
from public,anon;
grant execute on function
 public.essential_boss_handoff_status(uuid),
 public.essential_boss_handoff_request(uuid,uuid,text,text),
 public.essential_boss_handoff_accept(uuid,uuid,integer,text),
 public.essential_boss_handoff_complete(uuid,uuid,integer,text),
 public.essential_boss_handoff_cancel(uuid,uuid,integer)
to authenticated;
