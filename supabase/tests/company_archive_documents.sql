-- Synthetic metadata only; no real PDF is read, uploaded or deleted. All SQL is rolled back.
begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;j uuid;doc uuid:=gen_random_uuid();ex uuid:=gen_random_uuid();im uuid:=gen_random_uuid();h jsonb;p text;path text;proof text;denied boolean;ctx jsonb;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 c:=public.platform_create_test_company('Archive document fixture','essential',10);select default_punch_job_id into j from public.companies where id=c;
 path:=c::text||'/'||j::text||'/fixture.pdf';
 insert into storage.objects(bucket_id,name,metadata,updated_at) values('job-documents',path,'{"size":9,"mimetype":"application/pdf"}',now()-interval '1 day');
 insert into public.job_documents(id,company_id,job_id,name,storage_path,created_by) values(doc,c,j,'Fixture PDF',path,owner_id);
 execute 'set local role authenticated';h:=public.company_export_create(c,ex,'PDF fixture export');ctx:=public.company_archive_file_context(ex,'job-documents',path);
 if (ctx->'file'->>'size')::int<>9 or ctx->'file'->>'updated_at' is null then raise exception 'Document snapshot incomplete';end if;
 denied:=false;begin perform public.company_archive_file_proof(owner_id,ex,'job-documents',path,repeat('a',64));exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Browser can sign files';end if;
 execute 'reset role';proof:=public.company_archive_file_proof(owner_id,ex,'job-documents',path,repeat('a',64));select payload_text into p from private.company_exports where id=ex;
 execute 'set local role authenticated';perform public.company_archive_import(p,h->>'signature',(h->>'key_id')::uuid,'PDF fixture import',im);execute 'reset role';
 perform public.company_archive_file_proof(owner_id,im,'job-documents',path,repeat('a',64),proof);
 denied:=false;begin perform public.company_archive_file_proof(owner_id,im,'job-documents',path,repeat('b',64),proof);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Modified file accepted';end if;
 denied:=false;begin perform public.company_archive_file_proof(owner_id,im,'job-documents',path,repeat('a',64));exception when raise_exception then denied:=true;end;if not denied then raise exception 'Imported archive can sign new bytes';end if;
 execute 'set local role authenticated';denied:=false;begin perform public.company_archive_file_context(im,'job-documents',c::text||'/../foreign.pdf');exception when raise_exception then denied:=true;end;if not denied then raise exception 'Traversal accepted';end if;
 execute 'reset role';update storage.objects set updated_at=clock_timestamp()+interval '1 second' where bucket_id='job-documents' and name=path;
 execute 'set local role authenticated';denied:=false;begin perform public.company_archive_file_context(ex,'job-documents',path);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Changed object snapshot accepted';end if;
 execute 'reset role';
end $$;
rollback;
