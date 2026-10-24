create table public.scheduled_shifts (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, user_id uuid not null, job_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null, note text not null default '',
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 cancelled_at timestamptz, check(ends_at>starts_at),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id),
 foreign key(company_id,job_id) references public.jobs(company_id,id)
);
create index scheduled_shifts_worker_date on public.scheduled_shifts(company_id,user_id,starts_at);
alter table public.scheduled_shifts enable row level security;
create policy shift_read on public.scheduled_shifts for select to authenticated
 using(private.is_member(company_id) and (user_id=auth.uid() or private.is_manager(company_id) or private.lead_sees_job_for_worker(company_id,user_id,job_id)));
grant select on public.scheduled_shifts to authenticated;
create function public.schedule_shift(p_company uuid,p_user uuid,p_job uuid,p_start timestamptz,p_end timestamptz,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.can_administer(p_company) then raise exception 'Accès refusé'; end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '24 hours' then raise exception 'Quart invalide (maximum 24 h)'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||p_company::text||p_user::text,0));
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and status='active') then raise exception 'Membre inactif'; end if;
 if not exists(select 1 from public.jobs where company_id=p_company and id=p_job and active) then raise exception 'Job invalide'; end if;
 if exists(select 1 from public.scheduled_shifts where company_id=p_company and user_id=p_user and cancelled_at is null
 and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'Conflit avec un autre quart'; end if;
 if exists(select 1 from public.leave_requests where company_id=p_company and user_id=p_user and status='approved'
 and p_start<((ends_on+1)::timestamp at time zone 'America/Toronto') and p_end>(begins_on::timestamp at time zone 'America/Toronto')) then raise exception 'Congé approuvé pendant ce quart'; end if;
 insert into public.scheduled_shifts(company_id,user_id,job_id,starts_at,ends_at,note,created_by)
 values(p_company,p_user,p_job,p_start,p_end,coalesce(p_note,''),auth.uid()) returning id into v_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'shift_scheduled',v_id,jsonb_build_object('user',p_user,'job',p_job,'start',p_start,'end',p_end),coalesce(p_note,''));
 return v_id;
end $$;
create function public.cancel_shift(p_shift uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.scheduled_shifts;
begin
 select * into r from public.scheduled_shifts where id=p_shift;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||r.company_id::text||r.user_id::text,0));
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Motif requis'; end if;
 update public.scheduled_shifts set cancelled_at=clock_timestamp() where id=p_shift and cancelled_at is null;
 if not found then raise exception 'Quart déjà annulé'; end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason)
 values(r.company_id,auth.uid(),'shift_cancelled',r.id,to_jsonb(r),trim(p_reason));
end $$;
-- Recheck planned assignments under the same lock when granting leave.
create or replace function public.review_leave(p_request uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.leave_requests;
begin
 select * into r from public.leave_requests where id=p_request for update;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 if r.user_id=auth.uid() then raise exception 'Approbation de son propre congé interdite'; end if;
 if r.status<>'pending' or length(trim(coalesce(p_note,'')))<3 then raise exception 'Demande traitée ou motif manquant'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||r.company_id::text||r.user_id::text,0));
 if p_approve and exists(select 1 from public.scheduled_shifts x where x.company_id=r.company_id and x.user_id=r.user_id and x.cancelled_at is null
 and x.starts_at<((r.ends_on+1)::timestamp at time zone 'America/Toronto') and x.ends_at>(r.begins_on::timestamp at time zone 'America/Toronto'))
 then raise exception 'Annuler ou déplacer les quarts en conflit avant approbation'; end if;
 update public.leave_requests set status=case when p_approve then 'approved' else 'rejected' end where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(r.company_id,auth.uid(),'leave_review',r.id,to_jsonb(r),jsonb_build_object('approved',p_approve),trim(p_note));
end $$;

create table private.company_invitations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 token_hash bytea not null unique, email text not null, role text not null check(role in ('employee','lead','admin')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null, accepted_by uuid references auth.users(id), accepted_at timestamptz, revoked_at timestamptz
);
alter table private.company_invitations enable row level security;
create function public.create_company_invitation(p_company uuid,p_email text,p_role text,p_hours integer default 72)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token text:=gen_random_uuid()::text||gen_random_uuid()::text; v_id uuid; v_seats integer; v_count integer;
begin
 if not private.can_administer(p_company) then raise exception 'Accès refusé'; end if;
 select seat_limit into v_seats from public.companies where id=p_company and billing_status='active' for update;
 if not found then raise exception 'Paiement actif obligatoire avant invitation'; end if;
 if p_role not in ('employee','lead','admin') or p_hours not between 1 and 168 or p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invitation invalide'; end if;
 select (select count(*) from public.company_members where company_id=p_company and status='active')+
 (select count(*) from private.company_invitations where company_id=p_company and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) into v_count;
 if v_count>=v_seats then raise exception 'Places insuffisantes : achat requis'; end if;
 if exists(select 1 from private.company_invitations where company_id=p_company and email=lower(trim(p_email)) and accepted_at is null and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Invitation déjà en attente'; end if;
 insert into private.company_invitations(company_id,token_hash,email,role,created_by,expires_at)
 values(p_company,sha256(convert_to(v_token,'UTF8')),lower(trim(p_email)),p_role,auth.uid(),clock_timestamp()+make_interval(hours=>p_hours)) returning id into v_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(p_company,auth.uid(),'invitation_created',v_id,jsonb_build_object('role',p_role),'Invitation sécurisée');
 return jsonb_build_object('id',v_id,'token',v_token,'expires_in_hours',p_hours);
end $$;
create function public.accept_company_invitation(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r private.company_invitations; u auth.users; c public.companies;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select * into r from private.company_invitations where token_hash=sha256(convert_to(p_token,'UTF8'));
 if not found then raise exception 'Invitation invalide'; end if;
 select * into c from public.companies where id=r.company_id for update;
 select * into r from private.company_invitations where id=r.id for update;
 if r.accepted_at is not null or r.revoked_at is not null or r.expires_at<=clock_timestamp() then raise exception 'Invitation expirée ou utilisée'; end if;
 select * into u from auth.users where id=auth.uid();
 if u.email_confirmed_at is null or lower(u.email)<>r.email then raise exception 'Connecte-toi avec le courriel invité et confirmé'; end if;
 if c.billing_status<>'active' then raise exception 'Paiement de la compagnie requis'; end if;
 if exists(select 1 from public.company_members where company_id=c.id and user_id=auth.uid()) then raise exception 'Déjà membre de cette compagnie'; end if;
 if (select count(*) from public.company_members where company_id=c.id and status='active')>=c.seat_limit then raise exception 'Limite de places atteinte'; end if;
 insert into public.company_members(company_id,user_id,role) values(c.id,auth.uid(),r.role);
 update private.company_invitations set accepted_at=clock_timestamp(),accepted_by=auth.uid() where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
 values(c.id,auth.uid(),'invitation_accepted',r.id,jsonb_build_object('role',r.role),'Adhésion au rôle invité');
 return c.id;
end $$;
create function public.revoke_company_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r private.company_invitations;
begin
 select * into r from private.company_invitations where id=p_invitation;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 perform 1 from public.companies where id=r.company_id for update;
 update private.company_invitations set revoked_at=clock_timestamp() where id=r.id and accepted_at is null;
end $$;

-- Private job PDF objects: the path always begins with company UUID / job UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('job-documents','job-documents',false,26214400,array['application/pdf']) on conflict(id) do nothing;
create policy job_files_read on storage.objects for select to authenticated
 using(bucket_id='job-documents' and exists(select 1 from public.jobs j where j.company_id::text=(storage.foldername(name))[1]
 and j.id::text=(storage.foldername(name))[2] and private.is_member(j.company_id)));
create policy job_files_add on storage.objects for insert to authenticated
 with check(bucket_id='job-documents' and exists(select 1 from public.jobs j where j.company_id::text=(storage.foldername(name))[1]
 and j.id::text=(storage.foldername(name))[2] and private.can_administer(j.company_id)));
-- No update/delete policy: published revisions are immutable; new versions get a new path.
create function private.validate_job_document()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if split_part(new.storage_path,'/',1)<>new.company_id::text or split_part(new.storage_path,'/',2)<>new.job_id::text
 or not exists(select 1 from storage.objects where bucket_id='job-documents' and name=new.storage_path) then raise exception 'PDF privé introuvable dans cette compagnie/job'; end if;
 return new;
end $$;
revoke all on function private.validate_job_document() from public,anon,authenticated;
create trigger validate_job_document before insert on public.job_documents for each row execute function private.validate_job_document();

revoke all on function public.schedule_shift(uuid,uuid,uuid,timestamptz,timestamptz,text),public.cancel_shift(uuid,text),public.create_company_invitation(uuid,text,text,integer),public.accept_company_invitation(text),public.revoke_company_invitation(uuid) from public,anon;
grant execute on function public.schedule_shift(uuid,uuid,uuid,timestamptz,timestamptz,text),public.cancel_shift(uuid,text),public.create_company_invitation(uuid,text,text,integer),public.accept_company_invitation(text),public.revoke_company_invitation(uuid) to authenticated;
