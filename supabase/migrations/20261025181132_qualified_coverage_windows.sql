create table public.essential_qualified_coverage (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),department_id uuid not null,
 title text not null check(length(trim(title)) between 3 and 100),certificate_title text not null check(length(trim(certificate_title)) between 2 and 140),
 starts_at timestamptz not null,ends_at timestamptz not null,minimum_staff integer not null check(minimum_staff between 1 and 1000),
 active boolean not null default true,version integer not null default 1,updated_by uuid not null,updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at-starts_at<=interval '31 days'),foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
create index qualified_coverage_period on public.essential_qualified_coverage(company_id,starts_at,ends_at) where active;
create index certifications_title_worker on public.essential_certifications(company_id,lower(btrim(title)),worker_id);
alter table public.essential_qualified_coverage enable row level security;
create policy qualified_coverage_read on public.essential_qualified_coverage for select to authenticated using(private.is_manager(company_id) and private.essential_member_feature(company_id,'minimum_coverage'));
grant select on public.essential_qualified_coverage to authenticated;
revoke all on public.essential_qualified_coverage from anon;
revoke insert,update,delete on public.essential_qualified_coverage from authenticated;
create function public.save_qualified_coverage(p_company uuid,p_department uuid,p_title text,p_certificate text,p_start_local timestamp,p_end_local timestamp,p_minimum integer,p_active boolean,p_id uuid,p_version integer,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare zone text;old public.essential_qualified_coverage;result uuid;begins timestamptz;ends timestamptz;
begin
 if not private.can_administer(p_company) or not private.essential_hr_allowed(p_company,'certifications') or not private.essential_feature(p_company,'minimum_coverage') then raise exception using errcode='42501',message='Gestionnaire Pro avec permission Certifications requis';end if;
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Motif requis';end if;
 select l.timezone into zone from public.essential_departments d join public.essential_locations l on l.company_id=d.company_id and l.id=d.location_id where d.company_id=p_company and d.id=p_department and d.active and l.active;
 if not found then raise exception 'Département actif requis';end if;
 begins:=private.essential_local_instant(p_start_local,zone);ends:=private.essential_local_instant(p_end_local,zone);
 perform 1 from public.companies where id=p_company for update;
 if p_id is not null then select * into old from public.essential_qualified_coverage where id=p_id and company_id=p_company for update;if not found then raise exception 'Règle introuvable';end if;end if;
 if coalesce(old.version,0) is distinct from p_version then raise exception 'Règle modifiée : actualiser';end if;
 if p_active and (p_id is null or not old.active) and (select count(*) from public.essential_qualified_coverage where company_id=p_company and active)>=100 then raise exception 'Maximum de 100 plages actives; désactiver les anciennes';end if;
 if p_id is null then insert into public.essential_qualified_coverage(company_id,department_id,title,certificate_title,starts_at,ends_at,minimum_staff,active,updated_by) values(p_company,p_department,trim(p_title),trim(p_certificate),begins,ends,p_minimum,p_active,auth.uid()) returning id into result;
 else update public.essential_qualified_coverage set department_id=p_department,title=trim(p_title),certificate_title=trim(p_certificate),starts_at=begins,ends_at=ends,minimum_staff=p_minimum,active=p_active,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning id into result;end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(p_company,auth.uid(),'qualified_coverage_saved',result,trim(p_reason));return result;
end $$;
create function public.qualified_coverage_report(p_company uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_manager(p_company) or not private.essential_feature(p_company,'minimum_coverage') then raise exception using errcode='42501',message='Gestionnaire Pro requis';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '31 days' then raise exception 'Période maximale : 31 jours';end if;
 if (select count(*) from public.scheduled_shifts where company_id=p_company and cancelled_at is null and starts_at<p_end and ends_at>p_start)>10000 then raise exception 'Période trop chargée : réduire la plage';end if;
 with rules as materialized (
 select r.*,d.name department_name,l.timezone,greatest(p_start,r.starts_at) a,least(p_end,r.ends_at) b from public.essential_qualified_coverage r join public.essential_departments d on d.company_id=r.company_id and d.id=r.department_id join public.essential_locations l on l.company_id=d.company_id and l.id=d.location_id where r.company_id=p_company and r.active and d.active and l.active and r.starts_at<p_end and r.ends_at>p_start
 ),bounds as (
 select id,a t from rules union select id,b from rules
 union select r.id,greatest(r.a,s.starts_at) from rules r join public.scheduled_shifts s on s.company_id=p_company and s.department_id=r.department_id and s.cancelled_at is null and s.starts_at<r.b and s.ends_at>r.a
 union select r.id,least(r.b,s.ends_at) from rules r join public.scheduled_shifts s on s.company_id=p_company and s.department_id=r.department_id and s.cancelled_at is null and s.starts_at<r.b and s.ends_at>r.a
 -- Local midnights split certificate validity and whole-day approved absences, including DST.
 union select r.id,day::timestamp at time zone r.timezone from rules r cross join lateral generate_series((r.a at time zone r.timezone)::date::timestamp,((r.b at time zone r.timezone)::date+1)::timestamp,interval '1 day') day where day::timestamp at time zone r.timezone>r.a and day::timestamp at time zone r.timezone<r.b
 ),windows as(select id,t a,lead(t) over(partition by id order by t) b from bounds),counts as (
 select r.id,r.title,r.department_name,r.certificate_title,r.timezone,w.a starts_at,w.b ends_at,r.minimum_staff,
 (select count(distinct s.worker_id) from public.scheduled_shifts s join public.company_workers worker on worker.company_id=s.company_id and worker.id=s.worker_id and worker.status='active' where s.company_id=p_company and s.department_id=r.department_id and s.cancelled_at is null and s.starts_at<=w.a and s.ends_at>=w.b
 and exists(select 1 from public.essential_certifications cert where cert.company_id=p_company and cert.worker_id=worker.id and lower(btrim(cert.title))=lower(btrim(r.certificate_title)) and cert.issued_on<=(w.a at time zone r.timezone)::date and (cert.expires_on is null or cert.expires_on>=(w.a at time zone r.timezone)::date))
 and not exists(select 1 from public.leave_requests leave where leave.company_id=p_company and leave.user_id=worker.auth_user_id and leave.status='approved' and leave.begins_on<=(w.a at time zone r.timezone)::date and leave.ends_on>=(w.a at time zone r.timezone)::date)) staffed
 from rules r join windows w on w.id=r.id where w.b>w.a
 ),gaps as materialized(select * from counts where staffed<minimum_staff)
 select jsonb_build_object('start',p_start,'end',p_end,'rules',(select count(*) from rules),'gap_count',(select count(*) from gaps),'truncated',(select count(*)>2000 from gaps),'gaps',coalesce((select jsonb_agg(to_jsonb(g) order by g.starts_at,g.id) from (select * from gaps order by starts_at,id limit 2000) g),'[]'::jsonb),'notice','Couverture indépendante par qualification : salariés actifs avec quart affecté et certificat émis/valide, hors congé approuvé. Un salarié peut satisfaire plusieurs qualifications simultanément. Aucun poste exclusif ni heure officielle modifiés.') into result;
 return result;
end $$;
revoke all on function public.save_qualified_coverage(uuid,uuid,text,text,timestamp,timestamp,integer,boolean,uuid,integer,text),public.qualified_coverage_report(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.save_qualified_coverage(uuid,uuid,text,text,timestamp,timestamp,integer,boolean,uuid,integer,text),public.qualified_coverage_report(uuid,timestamptz,timestamptz) to authenticated;
-- Keep the business archive coherent; recovered future requirements stay disabled.
do $$
declare source text;modified text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 modified:=replace(source,') collections),','union all select ''public.essential_qualified_coverage'' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_qualified_coverage t where company_id=p_company) source),''[]''::jsonb) as rows ) collections),');
 if modified=source then raise exception 'Archive source changed';end if;execute modified;
 source:=pg_get_functiondef('private.company_restore_tables()'::regprocedure);modified:=replace(source,'''workforce_audit'']','''essential_qualified_coverage'',''workforce_audit'']');if modified=source then raise exception 'Restore list changed';end if;execute modified;
 source:=pg_get_functiondef('private.company_restore_rows(jsonb,text,uuid)'::regprocedure);modified:=replace(source,'t=''essential_payroll_export_profiles''','t in (''essential_payroll_export_profiles'',''essential_qualified_coverage'')');if modified=source then raise exception 'Restore sanitization changed';end if;execute modified;
end $$;
