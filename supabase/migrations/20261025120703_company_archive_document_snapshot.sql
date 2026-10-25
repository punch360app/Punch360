-- Preserve the existing signing key and snapshot query; append a signed object version.
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$'mimetype',o.metadata->>'mimetype'$old$,$new$'mimetype',o.metadata->>'mimetype','updated_at',o.updated_at$new$);
 if changed=source then raise exception 'Archive payload source changed: inspect before migration';end if;
 execute changed;
end $migration$;
create or replace function public.company_archive_file_context(p_id uuid,p_bucket text,p_path text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;f jsonb;
begin
 r:=private.company_archive_entry(p_id);
 if p_bucket not in('essential-hr','job-documents') or p_bucket is null or p_path is null or length(p_path)>1024 or split_part(p_path,'/',1)<>r.company_id::text or p_path like '%\%' or string_to_array(p_path,'/') && array['.','..',''] then raise exception 'Chemin de document refusé';end if;
 select value into f from jsonb_array_elements(r.manifest->'files') where value->>'bucket'=p_bucket and value->>'path'=p_path;
 if f is null then raise exception 'Document absent de l’archive signée';end if;
 if r.kind='export' and f->>'updated_at' is not null and not exists(select 1 from storage.objects where bucket_id=p_bucket and name=p_path and updated_at=(f->>'updated_at')::timestamptz) then raise exception 'Document modifié depuis la capture';end if;
 return jsonb_build_object('kind',r.kind,'company_id',r.company_id,'sha256',r.sha256,'key_id',r.key_id,'actor_id',r.actor_id,'file',f);
end $$;

select cron.schedule('punch-expired-company-exports','*/15 * * * *','delete from private.company_exports where expires_at<now()');
