create function private.company_archive_manifest(p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('collections',(select jsonb_agg(jsonb_build_object('name',key,'rows',jsonb_array_length(value),'sha256',encode(extensions.digest(value::text,'sha256'),'hex')) order by key) from jsonb_each(p->'collections')),'rows',(select sum(jsonb_array_length(value)) from jsonb_each(p->'collections')),'files',p->'files','excluded',p->'excluded')
$$;
revoke all on function private.company_archive_manifest(jsonb) from public,anon,authenticated;
create function private.company_archive_entry(p_id uuid) returns private.company_exports language plpgsql security definer set search_path='' as $$
declare r private.company_exports;
begin
 select * into r from private.company_exports where id=p_id;
 if not found or r.actor_id is distinct from auth.uid() or r.expires_at<clock_timestamp() then raise exception using errcode='42501',message='Archive temporaire inaccessible ou expirée';end if;
 perform private.assert_company_archive_access(r.company_id);return r;
end $$;
revoke all on function private.company_archive_entry(uuid) from public,anon,authenticated;
create function public.company_export_header(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;p jsonb;
begin
 r:=private.company_archive_entry(p_id);p:=r.payload_text::jsonb;
 return jsonb_build_object('id',r.id,'company_id',r.company_id,'company_name',p->>'company_name','kind',r.kind,'created_at',p->>'exported_at','expires_at',r.expires_at,'sha256',r.sha256,'signature',r.signature,'key_id',r.key_id,'manifest',r.manifest,'bytes',octet_length(r.payload_text),'characters',length(r.payload_text),'chunks',ceil(length(r.payload_text)/131072.0)::integer);
end $$;
create function public.company_export_create(p_company uuid,p_request uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;r private.company_exports;payload text;hash text;k uuid;
begin
 perform private.assert_company_archive_access(p_company);
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Identifiant et motif requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('archive:'||auth.uid()::text,0));
 delete from private.company_exports where expires_at<clock_timestamp();
 select * into r from private.company_exports where id=p_request;
 if found then if r.actor_id is distinct from auth.uid() or r.company_id<>p_company or r.kind<>'export' then raise exception 'Identifiant déjà utilisé';end if;return public.company_export_header(r.id);end if;
 if (select count(*) from private.company_exports where actor_id=auth.uid())>=5 then raise exception 'Cinq archives temporaires actives : supprimer une copie serveur avant de recommencer';end if;
 p:=private.company_archive_payload(p_company);payload:=p::text;
 if octet_length(payload)>20971520 then raise exception 'Export supérieur à 20 Mo de données : export opérateur requis, aucune ligne tronquée';end if;
 hash:=encode(extensions.digest(payload,'sha256'),'hex');select id into k from private.company_archive_keys order by created_at desc limit 1;
 insert into private.company_exports(id,company_id,actor_id,kind,payload_text,sha256,signature,key_id,manifest,reason) values(p_request,p_company,auth.uid(),'export',payload,hash,private.company_archive_sign(k,'data-v1|'||hash),k,private.company_archive_manifest(p),trim(p_reason));
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_export_created',p_company,jsonb_build_object('archive',p_request,'sha256',hash,'reason',trim(p_reason)));
 return public.company_export_header(p_request);
end $$;
create function public.company_export_chunk(p_id uuid,p_index integer) returns text language plpgsql security definer set search_path='' as $$
declare r private.company_exports;
begin
 r:=private.company_archive_entry(p_id);
 if p_index is null or p_index<0 or p_index>=ceil(length(r.payload_text)/131072.0)::integer then raise exception 'Bloc d’archive invalide';end if;
 return substring(r.payload_text from p_index*131072+1 for 131072);
end $$;
create function private.company_archive_validate(p_payload text,p_signature text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;hash text;expected text;
begin
 if p_payload is null or octet_length(p_payload)>20971520 or p_signature is null or p_signature !~ '^[a-f0-9]{64}$' then raise exception 'Archive invalide';end if;
 p:=p_payload::jsonb;
 if p->>'format' is distinct from 'punch-company-data' or p->>'version' is distinct from '1' or p->>'project' is distinct from 'mlabstdxxwjdpfaxiwmg' or jsonb_typeof(p->'collections') is distinct from 'object' or jsonb_typeof(p->'files') is distinct from 'array' then raise exception 'Format d’archive incompatible';end if;
 perform private.assert_company_archive_access((p->>'company_id')::uuid);
 hash:=encode(extensions.digest(p_payload,'sha256'),'hex');expected:=private.company_archive_sign(p_key,'data-v1|'||hash);
 if extensions.digest(p_signature,'sha256')<>extensions.digest(expected,'sha256') then raise exception using errcode='42501',message='Signature de sauvegarde invalide';end if;
 return p;
end $$;
revoke all on function private.company_archive_validate(text,text,uuid) from public,anon,authenticated;
create function public.company_archive_import(p_payload text,p_signature text,p_key uuid,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;c uuid;r private.company_exports;hash text;
begin
 p:=private.company_archive_validate(p_payload,p_signature,p_key);c:=(p->>'company_id')::uuid;
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Identifiant et motif requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('archive:'||auth.uid()::text,0));delete from private.company_exports where expires_at<clock_timestamp();
 hash:=encode(extensions.digest(p_payload,'sha256'),'hex');select * into r from private.company_exports where id=p_request;
 if found then if r.actor_id is distinct from auth.uid() or r.company_id<>c or r.kind<>'import' or r.sha256<>hash then raise exception 'Identifiant déjà utilisé';end if;return public.company_export_header(r.id);end if;
 if (select count(*) from private.company_exports where actor_id=auth.uid())>=5 then raise exception 'Cinq archives temporaires actives : supprimer une copie serveur';end if;
 insert into private.company_exports(id,company_id,actor_id,kind,payload_text,sha256,signature,key_id,manifest,reason) values(p_request,c,auth.uid(),'import',p_payload,hash,p_signature,p_key,private.company_archive_manifest(p),trim(p_reason));
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_archive_verified',c,jsonb_build_object('archive',p_request,'sha256',hash,'reason',trim(p_reason)));
 return public.company_export_header(p_request);
end $$;
create function public.company_export_discard(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r private.company_exports;
begin
 r:=private.company_archive_entry(p_id);delete from private.company_exports where id=p_id;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_export_copy_removed',r.company_id,jsonb_build_object('archive',p_id));
end $$;
create function public.company_archive_file_context(p_id uuid,p_bucket text,p_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;f jsonb;
begin
 r:=private.company_archive_entry(p_id);
 if p_bucket not in('essential-hr','job-documents') or p_bucket is null or p_path is null or length(p_path)>1024 or split_part(p_path,'/',1)<>r.company_id::text or p_path like '%\%' or string_to_array(p_path,'/') && array['.','..',''] then raise exception 'Chemin de document refusé';end if;
 select value into f from jsonb_array_elements(r.manifest->'files') where value->>'bucket'=p_bucket and value->>'path'=p_path;
 if f is null then raise exception 'Document absent de l’archive signée';end if;
 return jsonb_build_object('company_id',r.company_id,'sha256',r.sha256,'key_id',r.key_id,'actor_id',r.actor_id,'file',f);
end $$;
create function public.company_archive_file_proof(p_actor uuid,p_id uuid,p_bucket text,p_path text,p_sha256 text,p_signature text default null) returns text language plpgsql security definer set search_path='' as $$
declare r private.company_exports;expected text;
begin
 select * into r from private.company_exports where id=p_id and actor_id=p_actor and expires_at>clock_timestamp();
 if not found or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or not exists(select 1 from jsonb_array_elements(r.manifest->'files') x where x->>'bucket'=p_bucket and x->>'path'=p_path) then raise exception 'Document ou acteur refusé';end if;
 expected:=private.company_archive_sign(r.key_id,'file-v1|'||r.sha256||'|'||p_bucket||'|'||p_path||'|'||p_sha256);
 if p_signature is not null and (p_signature !~ '^[a-f0-9]{64}$' or extensions.digest(p_signature,'sha256')<>extensions.digest(expected,'sha256')) then raise exception 'Signature de document invalide';end if;
 if p_signature is null and r.kind<>'export' then raise exception 'Une importation ne peut signer de nouveau document';end if;
 return expected;
end $$;
revoke all on function public.company_archive_file_proof(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.company_archive_file_proof(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.company_export_create(uuid,uuid,text),public.company_export_header(uuid),public.company_export_chunk(uuid,integer),public.company_archive_import(text,text,uuid,text,uuid),public.company_export_discard(uuid),public.company_archive_file_context(uuid,text,text) from public,anon;
grant execute on function public.company_export_create(uuid,uuid,text),public.company_export_header(uuid),public.company_export_chunk(uuid,integer),public.company_archive_import(text,text,uuid,text,uuid),public.company_export_discard(uuid),public.company_archive_file_context(uuid,text,text) to authenticated;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('punch-expired-company-exports','17 3 * * *','delete from private.company_exports where expires_at<now()');end if;end $$;
