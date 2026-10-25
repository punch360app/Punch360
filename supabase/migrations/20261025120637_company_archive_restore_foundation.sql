-- Recovery adds missing business records. Current data, permissions and payments are never overwritten.
create table private.company_restore_runs(id uuid primary key,archive_id uuid not null,company_id uuid not null,actor_id uuid not null,plan_hash text not null,result jsonb not null,created_at timestamptz not null default now());
alter table private.company_restore_runs enable row level security;
revoke all on private.company_restore_runs from public,anon,authenticated;
create function private.company_restore_tables() returns text[] language sql immutable set search_path='' as $$
 select array['jobs','essential_locations','essential_departments','company_workers','punch_sessions','punch_segments','punch_breaks','scheduled_shifts','leave_requests','essential_availability','essential_announcements','essential_shift_notes','job_documents','essential_hr_documents','essential_certifications','document_acknowledgements','essential_hr_receipts','essential_announcement_receipts','essential_shift_acknowledgements','essential_pay_rules','essential_pay_rates','essential_pay_credits','essential_bank_entries','essential_payroll_estimates','punch_location_checks','punch_correction_requests','essential_break_corrections','essential_shift_requests','material_orders','workforce_audit']::text[]
$$;
revoke all on function private.company_restore_tables() from public,anon,authenticated;
create function private.company_restore_rows(p jsonb,t text,c uuid) returns jsonb language plpgsql immutable set search_path='' as $$
declare rows jsonb;
begin
 if not t=any(private.company_restore_tables()) then raise exception 'Collection de restauration interdite';end if;
 select coalesce(jsonb_agg(case when t='company_workers' then value||jsonb_build_object('auth_user_id',null,'status','disabled','personal_access',false,'can_mobile_punch',false,'can_kiosk_punch',false,'role','employee','sms_consent_at',null) when t='scheduled_shifts' then value||jsonb_build_object('cancelled_at',coalesce(value->>'cancelled_at',p->>'exported_at')) else value end order by value::text),'[]'::jsonb) into rows
 from jsonb_array_elements(coalesce(p->'collections'->('public.'||t),'[]'::jsonb)) x(value)
 where (not(value ? 'company_id') or value->>'company_id'=c::text)
 and (t<>'punch_sessions' or value->>'ended_at' is not null)
 and (t not in('punch_segments','punch_breaks','punch_location_checks','punch_correction_requests','essential_break_corrections') or exists(select 1 from jsonb_array_elements(p->'collections'->'public.punch_sessions') s where s->>'id'=value->>'session_id' and s->>'ended_at' is not null));
 return rows;
end $$;
revoke all on function private.company_restore_rows(jsonb,text,uuid) from public,anon,authenticated;
-- Internal transaction guard: clients cannot create a historical-recovery context.
create table private.company_restore_context(tx bigint primary key,company_id uuid not null,actor_id uuid not null);
alter table private.company_restore_context enable row level security;
revoke all on private.company_restore_context from public,anon,authenticated;
create or replace function private.bind_session_worker() returns trigger language plpgsql security definer set search_path='' as $$
declare w public.company_workers; historical boolean;
begin
 if exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then
  select * into w from public.company_workers where company_id=new.company_id and ((new.worker_id is not null and id=new.worker_id) or (new.worker_id is null and auth_user_id=new.user_id));
  historical:=TG_OP='INSERT' and new.ended_at is not null and exists(select 1 from private.company_restore_context where tx=txid_current() and company_id=new.company_id and actor_id=auth.uid());
  if w.id is null or (not historical and (w.status<>'active' or w.auth_user_id is distinct from new.user_id)) then raise exception 'Identité salariée invalide';end if;
  new.worker_id:=w.id;
  if historical then new.user_id:=w.auth_user_id;end if;
 elsif new.worker_id is not null then raise exception 'Identité Essentiel sur une session Construction';end if;
 return new;
end $$;
-- Every reference to a company-scoped row must still belong to the original company.
create function private.company_restore_reference_ok(t text,row_data jsonb,c uuid) returns boolean language plpgsql set search_path='' as $$
declare fk record;match_sql text;nullable boolean;ok boolean;
begin
 for fk in select con.confrelid,con.conkey,con.confkey from pg_constraint con where con.conrelid=to_regclass('public.'||t) and con.contype='f' loop
  if not exists(select 1 from pg_attribute where attrelid=fk.confrelid and attname='company_id' and not attisdropped) then continue;end if;
  select bool_or(row_data->>a.attname is null),string_agg(format('r.%I::text=$1->>%L',b.attname,a.attname),' and ') into nullable,match_sql
   from unnest(fk.conkey,fk.confkey) keys(src,dst) join pg_attribute a on a.attrelid=to_regclass('public.'||t) and a.attnum=keys.src join pg_attribute b on b.attrelid=fk.confrelid and b.attnum=keys.dst;
  if nullable then continue;end if;
  execute format('select exists(select 1 from %s r where %s and r.company_id=$2)',fk.confrelid::regclass,match_sql) into ok using row_data,c;
  if not ok then return false;end if;
 end loop;return true;
end $$;
revoke all on function private.company_restore_reference_ok(text,jsonb,uuid) from public,anon,authenticated;
