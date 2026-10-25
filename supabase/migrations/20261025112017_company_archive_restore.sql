-- Recovery adds missing business records. Current data, permissions and payments are never overwritten.
create table private.company_restore_runs(id uuid primary key,archive_id uuid not null,company_id uuid not null,actor_id uuid not null,plan_hash text not null,result jsonb not null,created_at timestamptz not null default now());
alter table private.company_restore_runs enable row level security;
revoke all on private.company_restore_runs from public,anon,authenticated;
create function private.company_restore_tables() returns text[] language sql immutable set search_path='' as $$
 select array['jobs','essential_locations','essential_departments','company_workers','punch_sessions','punch_segments','punch_breaks','scheduled_shifts','leave_requests','essential_availability','essential_announcements','essential_shift_notes','job_documents','essential_hr_documents','essential_certifications','document_acknowledgements','essential_hr_receipts','essential_announcement_receipts','essential_shift_acknowledgements','essential_pay_rules','essential_pay_rates','essential_pay_credits','essential_bank_entries','essential_payroll_estimates','punch_location_checks','punch_correction_requests','essential_break_corrections','essential_shift_requests','material_orders','payroll_weeks','workforce_audit']::text[]
$$;
revoke all on function private.company_restore_tables() from public,anon,authenticated;
create function private.company_restore_rows(p jsonb,t text,c uuid) returns jsonb language plpgsql immutable set search_path='' as $$
declare rows jsonb;
begin
 if not t=any(private.company_restore_tables()) then raise exception 'Collection de restauration interdite';end if;
 select coalesce(jsonb_agg(case when t='company_workers' then value||jsonb_build_object('auth_user_id',null,'status','disabled','personal_access',false,'can_mobile_punch',false,'can_kiosk_punch',false) else value end order by value::text),'[]'::jsonb) into rows
 from jsonb_array_elements(coalesce(p->'collections'->('public.'||t),'[]'::jsonb)) x(value)
 where (not(value ? 'company_id') or value->>'company_id'=c::text)
 and (t<>'punch_sessions' or value->>'ended_at' is not null)
 and (t not in('punch_segments','punch_breaks','punch_location_checks','punch_correction_requests','essential_break_corrections') or exists(select 1 from jsonb_array_elements(p->'collections'->'public.punch_sessions') s where s->>'id'=value->>'session_id' and s->>'ended_at' is not null));
 return rows;
end $$;
revoke all on function private.company_restore_rows(jsonb,text,uuid) from public,anon,authenticated;
create function public.company_restore_plan(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;p jsonb;t text;rows jsonb;join_sql text;tenant_sql text;stats jsonb;tables jsonb:='[]';report jsonb;missing bigint:=0;conflicts bigint:=0;unchanged bigint:=0;policy_skipped bigint:=0;
begin
 r:=private.company_archive_entry(p_id);p:=r.payload_text::jsonb;
 foreach t in array private.company_restore_tables() loop
  rows:=private.company_restore_rows(p,t,r.company_id);
  select string_agg(format('e.%1$I=x.%1$I',a.attname),' and ' order by a.attnum) into join_sql from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=to_regclass('public.'||t) and i.indisprimary;
  if join_sql is null then raise exception 'Clé de collection manquante';end if;
  if t='document_acknowledgements' then tenant_sql:='exists(select 1 from public.job_documents d where d.id=e.document_id and d.company_id=$3)';
  elsif t='essential_hr_receipts' then tenant_sql:='exists(select 1 from public.essential_hr_documents d where d.id=e.document_id and d.company_id=$3)';
  elsif t='essential_announcement_receipts' then tenant_sql:='exists(select 1 from public.essential_announcements d where d.id=e.announcement_id and d.company_id=$3)';
  elsif t='essential_shift_acknowledgements' then tenant_sql:='exists(select 1 from public.scheduled_shifts d where d.id=e.shift_id and d.company_id=$3)';
  else tenant_sql:='e.company_id=$3';end if;
  execute format('select jsonb_build_object(''name'',$2,''eligible'',jsonb_array_length($1),''missing'',count(*) filter(where e.tableoid is null),''conflicts'',count(*) filter(where e.tableoid is not null and to_jsonb(e)<>to_jsonb(x)),''unchanged'',count(*) filter(where e.tableoid is not null and to_jsonb(e)=to_jsonb(x)),''fingerprint'',encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_object(''source'',to_jsonb(x),''current'',case when e.tableoid is null then null else to_jsonb(e) end) order by to_jsonb(x)::text),''[]''::jsonb)::text,''sha256''),''hex'')) from jsonb_populate_recordset(null::public.%I,$1) x left join public.%I e on %s and (%s)',t,t,join_sql,tenant_sql) into stats using rows,t,r.company_id;
  missing:=missing+(stats->>'missing')::bigint;conflicts:=conflicts+(stats->>'conflicts')::bigint;unchanged:=unchanged+(stats->>'unchanged')::bigint;
  policy_skipped:=policy_skipped+jsonb_array_length(coalesce(p->'collections'->('public.'||t),'[]'::jsonb))-jsonb_array_length(rows);
  tables:=tables||jsonb_build_array(stats);
 end loop;
 report:=jsonb_build_object('archive_id',r.id,'company_id',r.company_id,'company_name',p->>'company_name','archive_sha256',r.sha256,'missing',missing,'conflicts',conflicts,'unchanged',unchanged,'policy_skipped',policy_skipped,'tables',tables,
 'preserved',jsonb_build_array('existing_rows','roles_and_permissions','authentication','billing_state','kiosk_credentials','invitation_tokens','open_punch_sessions'));
 return report||jsonb_build_object('plan_hash',encode(extensions.digest(report::text,'sha256'),'hex'));
end $$;
create function public.company_restore_missing(p_id uuid,p_plan_hash text,p_confirmation text,p_reason text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.company_exports;old private.company_restore_runs;p jsonb;plan jsonb;t text;rows jsonb;added bigint;total bigint:=0;report jsonb:='[]';result jsonb;scope text;
begin
 r:=private.company_archive_entry(p_id);p:=r.payload_text::jsonb;
 if p_request is null or length(trim(coalesce(p_reason,''))) not between 3 and 1000 or p_confirmation is distinct from (select name from public.companies where id=r.company_id) then raise exception 'Nom actuel de l’entreprise et motif requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('restore:'||r.company_id::text,0));
 select * into old from private.company_restore_runs where id=p_request;
 if found then if old.actor_id is distinct from auth.uid() or old.archive_id<>p_id or old.plan_hash is distinct from p_plan_hash then raise exception 'Identifiant déjà utilisé';end if;return old.result;end if;
 plan:=public.company_restore_plan(p_id);
 if p_plan_hash is distinct from plan->>'plan_hash' then raise exception 'Prévisualisation périmée : vérifier à nouveau les changements';end if;
 foreach t in array private.company_restore_tables() loop
  rows:=private.company_restore_rows(p,t,r.company_id);scope:='true';
  if t='document_acknowledgements' then scope:='exists(select 1 from public.job_documents d where d.id=x.document_id and d.company_id=$2)';
  elsif t='essential_hr_receipts' then scope:='exists(select 1 from public.essential_hr_documents d where d.id=x.document_id and d.company_id=$2) and exists(select 1 from public.company_workers w where w.id=x.worker_id and w.company_id=$2)';
  elsif t='essential_announcement_receipts' then scope:='exists(select 1 from public.essential_announcements d where d.id=x.announcement_id and d.company_id=$2)';
  elsif t='essential_shift_acknowledgements' then scope:='exists(select 1 from public.scheduled_shifts d where d.id=x.shift_id and d.company_id=$2)';
  else scope:='x.company_id=$2';end if;
  execute format('with added as (insert into public.%I select x.* from jsonb_populate_recordset(null::public.%I,$1) x where %s on conflict do nothing returning 1) select count(*) from added',t,t,scope) into added using rows,r.company_id;
  total:=total+added;report:=report||jsonb_build_array(jsonb_build_object('name',t,'restored',added));
 end loop;
 result:=jsonb_build_object('restored',total,'tables',report,'conflicts_preserved',plan->'conflicts','policy_skipped',plan->'policy_skipped','company_id',r.company_id);
 insert into private.company_restore_runs(id,archive_id,company_id,actor_id,plan_hash,result) values(p_request,p_id,r.company_id,auth.uid(),p_plan_hash,result);
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_archive_restored_missing',r.company_id,jsonb_build_object('archive',p_id,'request',p_request,'restored',total,'reason',trim(p_reason)));
 return result;
end $$;
revoke all on function public.company_restore_plan(uuid),public.company_restore_missing(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.company_restore_plan(uuid),public.company_restore_missing(uuid,text,text,text,uuid) to authenticated;
