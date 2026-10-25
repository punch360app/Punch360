create function public.company_restore_plan(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;p jsonb;simulation jsonb;report jsonb;fingerprint text;
begin
 r:=private.company_archive_entry(p_id);p:=r.payload_text::jsonb;
 fingerprint:=encode(extensions.digest((private.company_archive_payload(r.company_id)-'exported_at')::text,'sha256'),'hex');
 -- A subtransaction verifies real constraints/triggers, and rolls back ALL preview writes.
 begin
  simulation:=private.company_restore_apply(p,r.company_id);
  raise sqlstate 'P3601' using message='rollback archive preview';
 exception when sqlstate 'P3601' then null;end;
 report:=simulation||jsonb_build_object('archive_id',r.id,'company_id',r.company_id,'company_name',(select name from public.companies where id=r.company_id),'archive_sha256',r.sha256,'current_fingerprint',fingerprint,'missing',simulation->'restored','preserved',jsonb_build_array('existing_rows','roles_and_permissions','authentication','billing_state','kiosk_credentials','invitation_tokens','open_punch_sessions','payroll_locks'),'recovered_workers','disabled_employee_without_account','recovered_shifts','cancelled');
 return report||jsonb_build_object('plan_hash',encode(extensions.digest(report::text,'sha256'),'hex'));
end $$;
create function public.company_restore_missing(p_id uuid,p_plan_hash text,p_confirmation text,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;old private.company_restore_runs;plan jsonb;result jsonb;t text;
begin
 r:=private.company_archive_entry(p_id);
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 or p_confirmation is distinct from (select name from public.companies where id=r.company_id) then raise exception 'Nom actuel de l’entreprise et motif requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('restore:'||r.company_id::text,0));
 select * into old from private.company_restore_runs where id=p_request;
 if found then if old.actor_id is distinct from auth.uid() or old.archive_id<>p_id or old.plan_hash is distinct from p_plan_hash then raise exception 'Identifiant déjà utilisé';end if;return old.result;end if;
 -- Brief, bounded serialization prevents a concurrent insert/update between preview and insert.
 perform set_config('lock_timeout','2s',true);
 foreach t in array private.company_restore_tables() loop execute format('lock table public.%I in share row exclusive mode',t);end loop;
 plan:=public.company_restore_plan(p_id);
 if p_plan_hash is distinct from plan->>'plan_hash' then raise exception 'Prévisualisation périmée : vérifier à nouveau les changements';end if;
 result:=private.company_restore_apply(r.payload_text::jsonb,r.company_id)||jsonb_build_object('company_id',r.company_id);
 if result->'restored' is distinct from plan->'restored' or result->'blocked' is distinct from plan->'blocked' or result->'conflicts' is distinct from plan->'conflicts' then raise exception 'Données modifiées : refaire la prévisualisation';end if;
 insert into private.company_restore_runs(id,archive_id,company_id,actor_id,plan_hash,result) values(p_request,p_id,r.company_id,auth.uid(),p_plan_hash,result);
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_archive_restored_missing',r.company_id,jsonb_build_object('archive',p_id,'request',p_request,'restored',result->'restored','reason',trim(p_reason)));
 return result;
end $$;
revoke all on function public.company_restore_plan(uuid),public.company_restore_missing(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.company_restore_plan(uuid),public.company_restore_missing(uuid,text,text,text,uuid) to authenticated;
-- Audit document recovery through a service-only endpoint; never returns storage credentials.
create function public.company_archive_file_restored(p_actor uuid,p_id uuid,p_bucket text,p_path text,p_sha256 text,p_signature text) returns void language plpgsql security definer set search_path='' as $$
declare r private.company_exports;
begin
 perform public.company_archive_file_proof(p_actor,p_id,p_bucket,p_path,p_sha256,p_signature);
 select * into r from private.company_exports where id=p_id and actor_id=p_actor and kind='import';
 if not found then raise exception 'Importation requise';end if;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(p_actor,'company_archive_document_recovered',r.company_id,jsonb_build_object('archive',p_id,'bucket',p_bucket,'path',p_path,'sha256',p_sha256));
end $$;
revoke all on function public.company_archive_file_restored(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.company_archive_file_restored(uuid,uuid,text,text,text,text) to service_role;

