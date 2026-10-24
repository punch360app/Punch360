-- Explicit delegated permissions: management is not blanket access to HR or wages.
create table public.essential_hr_grants (
 company_id uuid not null references public.companies(id),user_id uuid not null,
 documents boolean not null default false,certifications boolean not null default false,compensation boolean not null default false,
 updated_at timestamptz not null default now(),primary key(company_id,user_id),foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
alter table public.essential_hr_grants enable row level security;
create function private.essential_hr_allowed(p_company uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_members m where m.company_id=p_company and m.user_id=auth.uid() and m.status='active' and (m.role='boss' or (m.role='admin' and exists(select 1 from public.essential_hr_grants g where g.company_id=p_company and g.user_id=m.user_id and case p_permission when 'documents' then g.documents when 'certifications' then g.certifications when 'compensation' then g.compensation else false end))))
$$;
revoke all on function private.essential_hr_allowed(uuid,text) from public,anon;
grant execute on function private.essential_hr_allowed(uuid,text) to authenticated;
create policy hr_grants_read on public.essential_hr_grants for select to authenticated using(private.is_member(company_id) and (user_id=(select auth.uid()) or exists(select 1 from public.company_members where company_id=essential_hr_grants.company_id and user_id=(select auth.uid()) and role='boss' and status='active')));
grant select on public.essential_hr_grants to authenticated;
revoke insert,update,delete on public.essential_hr_grants from anon,authenticated;
create function public.set_essential_hr_grant(p_company uuid,p_user uuid,p_documents boolean,p_certifications boolean,p_compensation boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_administer(p_company) or not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role='boss' and status='active') then raise exception using errcode='42501',message='Boss requis';end if;
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=p_user and role='admin' and status='active') or p_documents is null or p_certifications is null or p_compensation is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Administrateur actif, permissions et motif requis';end if;
 insert into public.essential_hr_grants(company_id,user_id,documents,certifications,compensation) values(p_company,p_user,p_documents,p_certifications,p_compensation) on conflict(company_id,user_id) do update set documents=excluded.documents,certifications=excluded.certifications,compensation=excluded.compensation,updated_at=clock_timestamp();
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_hr_permissions',p_company,jsonb_build_object('user',p_user,'documents',p_documents,'certifications',p_certifications,'compensation',p_compensation,'reason',p_reason));
end $$;
create function public.essential_hr_access(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Accès refusé';end if;
 return jsonb_build_object('documents',private.essential_hr_allowed(p_company,'documents'),'certifications',private.essential_hr_allowed(p_company,'certifications'),'compensation',private.essential_hr_allowed(p_company,'compensation'));
end $$;
create table public.essential_hr_documents (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),series_id uuid not null,version integer not null check(version>0),
 title text not null check(length(trim(title)) between 2 and 140),category text not null check(category in ('handbook','policy','personal','training','other')),
 worker_id uuid,department_id uuid,storage_path text not null unique,requires_ack boolean not null default true,
 state text not null default 'draft' check(state in ('draft','published','withdrawn')),created_by uuid not null,created_at timestamptz not null default now(),published_at timestamptz,
 unique(company_id,id),unique(company_id,series_id,version),foreign key(company_id,worker_id) references public.company_workers(company_id,id),foreign key(company_id,department_id) references public.essential_departments(company_id,id),check(worker_id is null or department_id is null)
);
create index hr_docs_company_scope on public.essential_hr_documents(company_id,state,worker_id,department_id);
alter table public.essential_hr_documents enable row level security;
create function private.essential_hr_document_visible(p_document uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.essential_hr_documents d where d.id=p_document and private.is_member(d.company_id) and (private.essential_hr_allowed(d.company_id,'documents') or (d.state='published' and exists(select 1 from public.company_workers w where w.company_id=d.company_id and w.auth_user_id=auth.uid() and w.status='active' and w.personal_access and (d.worker_id is null or d.worker_id=w.id) and (d.department_id is null or d.department_id=w.department_id)))))
$$;
revoke all on function private.essential_hr_document_visible(uuid) from public,anon;
grant execute on function private.essential_hr_document_visible(uuid) to authenticated;
create policy hr_documents_read on public.essential_hr_documents for select to authenticated using(private.essential_hr_document_visible(id));
grant select on public.essential_hr_documents to authenticated;
revoke insert,update,delete on public.essential_hr_documents from anon,authenticated;
create table public.essential_hr_receipts (
 document_id uuid not null references public.essential_hr_documents(id),user_id uuid not null references auth.users(id),worker_id uuid not null references public.company_workers(id),read_at timestamptz not null default now(),primary key(document_id,user_id)
);
alter table public.essential_hr_receipts enable row level security;
create policy hr_receipts_read on public.essential_hr_receipts for select to authenticated using((user_id=(select auth.uid()) and exists(select 1 from public.essential_hr_documents d where d.id=document_id and private.is_member(d.company_id))) or exists(select 1 from public.essential_hr_documents d where d.id=document_id and private.essential_hr_allowed(d.company_id,'documents')));
grant select on public.essential_hr_receipts to authenticated;
revoke insert,update,delete on public.essential_hr_receipts from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('essential-hr','essential-hr',false,20971520,array['application/pdf']) on conflict(id) do nothing;
create policy essential_hr_download on storage.objects for select to authenticated using(bucket_id='essential-hr' and exists(select 1 from public.essential_hr_documents d where d.storage_path=name and private.essential_hr_document_visible(d.id)));
create policy essential_hr_upload on storage.objects for insert to authenticated with check(bucket_id='essential-hr' and exists(select 1 from public.essential_hr_documents d where d.storage_path=name and d.state='draft' and d.created_by=(select auth.uid()) and d.created_at>now()-interval '24 hours' and private.can_administer(d.company_id) and private.essential_hr_allowed(d.company_id,'documents') and private.essential_feature(d.company_id,'hr_documents')));
create function public.prepare_essential_hr_document(p_company uuid,p_title text,p_category text,p_worker uuid default null,p_department uuid default null,p_ack boolean default true,p_previous uuid default null) returns public.essential_hr_documents language plpgsql security definer set search_path='' as $$
declare d public.essential_hr_documents;previous public.essential_hr_documents;v_series uuid:=gen_random_uuid();v_version integer:=1;
begin
 if not private.can_administer(p_company) or not private.essential_hr_allowed(p_company,'documents') or not private.essential_feature(p_company,'hr_documents') then raise exception using errcode='42501',message='Permission Documents RH et forfait Pro requis';end if;
 if p_previous is not null then
 select * into previous from public.essential_hr_documents where id=p_previous and company_id=p_company and state='published' for update;if not found then raise exception 'Révision précédente publiée requise';end if;
 v_series:=previous.series_id;perform pg_advisory_xact_lock(hashtextextended(v_series::text,0));
 if exists(select 1 from public.essential_hr_documents where company_id=p_company and series_id=v_series and state='published' and version>previous.version) then raise exception 'Une version plus récente existe';end if;
 select max(version)+1 into v_version from public.essential_hr_documents where company_id=p_company and series_id=v_series;
 p_worker:=previous.worker_id;p_department:=previous.department_id;
 end if;
 if p_category='personal' and p_worker is null then raise exception 'Choisir le salarié destinataire du document personnel';end if;
 insert into public.essential_hr_documents(company_id,series_id,version,title,category,worker_id,department_id,storage_path,requires_ack,created_by) values(p_company,v_series,v_version,trim(p_title),p_category,p_worker,p_department,p_company::text||'/'||gen_random_uuid()::text||'.pdf',p_ack,auth.uid()) returning * into d;return d;
end $$;
create function public.publish_essential_hr_document(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.essential_hr_documents;
begin
 select * into d from public.essential_hr_documents where id=p_document for update;
 if not found or not private.can_administer(d.company_id) or not private.essential_hr_allowed(d.company_id,'documents') or not private.essential_feature(d.company_id,'hr_documents') then raise exception using errcode='42501',message='Permission Documents RH requise';end if;
 if d.state='published' then return;end if;
 if exists(select 1 from public.essential_hr_documents where company_id=d.company_id and series_id=d.series_id and version>d.version and state='published') then raise exception 'Une révision plus récente est déjà publiée';end if;
 if d.state<>'draft' or not exists(select 1 from storage.objects where bucket_id='essential-hr' and name=d.storage_path and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint between 1 and 20971520) then raise exception 'PDF privé valide requis avant publication';end if;
 update public.essential_hr_documents set state='published',published_at=clock_timestamp() where id=d.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(d.company_id,auth.uid(),'hr_document_published',d.id,jsonb_build_object('series',d.series_id,'version',d.version),'Publication RH');
end $$;
create function public.withdraw_essential_hr_document(p_document uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare d public.essential_hr_documents;
begin
 select * into d from public.essential_hr_documents where id=p_document for update;
 if not found or not private.can_administer(d.company_id) or not private.essential_hr_allowed(d.company_id,'documents') then raise exception using errcode='42501',message='Permission Documents RH requise';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Motif requis';end if;
 update public.essential_hr_documents set state='withdrawn' where id=d.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(d.company_id,auth.uid(),'hr_document_withdrawn',d.id,trim(p_reason));
end $$;
create function public.acknowledge_essential_hr_document(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.essential_hr_documents;w uuid;dept uuid;
begin
 select * into d from public.essential_hr_documents where id=p_document and state='published' and private.essential_hr_document_visible(id);
 if not found then raise exception using errcode='42501',message='Document personnel inaccessible';end if;
 select id,department_id into w,dept from public.company_workers where company_id=d.company_id and auth_user_id=auth.uid() and status='active' and personal_access;
 if w is null or (d.worker_id is not null and d.worker_id<>w) or (d.department_id is not null and d.department_id is distinct from dept) then raise exception 'Document destiné au salarié requis pour confirmer sa lecture';end if;
 insert into public.essential_hr_receipts(document_id,user_id,worker_id) values(d.id,auth.uid(),w) on conflict do nothing;
end $$;
create table public.essential_certifications (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),worker_id uuid not null,
 title text not null check(length(trim(title)) between 2 and 140),kind text not null check(kind in ('certification','training')),
 issued_on date,expires_on date,document_id uuid,version integer not null default 1,created_by uuid not null,updated_at timestamptz not null default now(),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),foreign key(company_id,document_id) references public.essential_hr_documents(company_id,id),check(expires_on is null or issued_on is null or expires_on>=issued_on)
);
create index certifications_expiry on public.essential_certifications(company_id,expires_on,worker_id);
alter table public.essential_certifications enable row level security;
create policy certifications_read on public.essential_certifications for select to authenticated using(private.is_member(company_id) and (private.essential_hr_allowed(company_id,'certifications') or exists(select 1 from public.company_workers w where w.company_id=essential_certifications.company_id and w.id=worker_id and w.auth_user_id=(select auth.uid()) and w.status='active' and w.personal_access)));
grant select on public.essential_certifications to authenticated;
revoke insert,update,delete on public.essential_certifications from anon,authenticated;
create function public.save_essential_certification(p_company uuid,p_worker uuid,p_title text,p_kind text,p_issued date,p_expires date,p_document uuid default null,p_id uuid default null,p_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.can_administer(p_company) or not private.essential_hr_allowed(p_company,'certifications') or not private.essential_feature(p_company,'certifications') then raise exception using errcode='42501',message='Permission Certifications et forfait Pro requis';end if;
 if p_document is not null and not exists(select 1 from public.essential_hr_documents where company_id=p_company and id=p_document and worker_id=p_worker and state='published') then raise exception 'Document privé du même salarié requis';end if;
 if p_id is null then insert into public.essential_certifications(company_id,worker_id,title,kind,issued_on,expires_on,document_id,created_by) values(p_company,p_worker,trim(p_title),p_kind,p_issued,p_expires,p_document,auth.uid()) returning id into result;
 else update public.essential_certifications set title=trim(p_title),kind=p_kind,issued_on=p_issued,expires_on=p_expires,document_id=p_document,version=version+1,updated_at=clock_timestamp() where id=p_id and company_id=p_company and worker_id=p_worker and version=p_version returning id into result;if result is null then raise exception 'Version périmée ou dossier différent';end if;end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'certification_saved',result,jsonb_build_object('worker',p_worker,'expires_on',p_expires),'Certification/formation enregistrée');return result;
end $$;
revoke all on function public.set_essential_hr_grant(uuid,uuid,boolean,boolean,boolean,text),public.essential_hr_access(uuid),public.prepare_essential_hr_document(uuid,text,text,uuid,uuid,boolean,uuid),public.publish_essential_hr_document(uuid),public.withdraw_essential_hr_document(uuid,text),public.acknowledge_essential_hr_document(uuid),public.save_essential_certification(uuid,uuid,text,text,date,date,uuid,uuid,integer) from public,anon;
grant execute on function public.set_essential_hr_grant(uuid,uuid,boolean,boolean,boolean,text),public.essential_hr_access(uuid),public.prepare_essential_hr_document(uuid,text,text,uuid,uuid,boolean,uuid),public.publish_essential_hr_document(uuid),public.withdraw_essential_hr_document(uuid,text),public.acknowledge_essential_hr_document(uuid),public.save_essential_certification(uuid,uuid,text,text,date,date,uuid,uuid,integer) to authenticated;
