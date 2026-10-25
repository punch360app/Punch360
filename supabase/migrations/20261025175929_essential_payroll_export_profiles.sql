-- CSV interchange profiles; no external payroll account, payment or transmission.
create table public.essential_payroll_export_profiles (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name)) between 3 and 100),version integer not null default 1,
 columns jsonb not null,delimiter text not null check(delimiter in (',',';')),active boolean not null default true,
 updated_by uuid not null,updated_at timestamptz not null default now(),unique(company_id,id)
);
create table public.essential_payroll_worker_mappings (
 company_id uuid not null,profile_id uuid not null,worker_id uuid not null,external_id text not null check(length(trim(external_id)) between 1 and 80 and external_id !~ '[[:cntrl:]]'),
 version integer not null default 1,updated_by uuid not null,updated_at timestamptz not null default now(),
 primary key(profile_id,worker_id),unique(profile_id,external_id),foreign key(company_id,profile_id) references public.essential_payroll_export_profiles(company_id,id),foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create table public.essential_payroll_export_runs (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,profile_id uuid not null,estimate_id uuid not null references public.essential_payroll_estimates(id),
 request_id uuid not null,created_by uuid not null,created_at timestamptz not null default now(),payload jsonb not null,unique(company_id,request_id),
 foreign key(company_id,profile_id) references public.essential_payroll_export_profiles(company_id,id)
);
alter table public.essential_payroll_export_profiles enable row level security;
alter table public.essential_payroll_worker_mappings enable row level security;
alter table public.essential_payroll_export_runs enable row level security;
create policy export_profiles_read on public.essential_payroll_export_profiles for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') and private.essential_member_feature(company_id,'payroll_integrations'));
create policy export_mappings_read on public.essential_payroll_worker_mappings for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') and private.essential_member_feature(company_id,'payroll_integrations'));
create policy export_runs_read on public.essential_payroll_export_runs for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') and private.essential_member_feature(company_id,'payroll_integrations'));
grant select on public.essential_payroll_export_profiles,public.essential_payroll_worker_mappings,public.essential_payroll_export_runs to authenticated;
revoke all on public.essential_payroll_export_profiles,public.essential_payroll_worker_mappings,public.essential_payroll_export_runs from anon;
revoke insert,update,delete on public.essential_payroll_export_profiles,public.essential_payroll_worker_mappings,public.essential_payroll_export_runs from authenticated;
create function public.save_payroll_export_profile(p_company uuid,p_id uuid,p_version integer,p_name text,p_columns jsonb,p_delimiter text,p_active boolean,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.essential_payroll_export_profiles; col jsonb; result uuid;
begin
 perform private.essential_assert_compensation(p_company);
 if not private.essential_feature(p_company,'payroll_integrations') then raise exception using errcode='42501',message='Module intégrations de paie requis';end if;
 if p_columns is null or jsonb_typeof(p_columns)<>'array' or jsonb_array_length(p_columns) not between 2 and 20 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Colonnes et motif requis';end if;
 for col in select value from jsonb_array_elements(p_columns) loop
  if jsonb_typeof(col)<>'object' or exists(select 1 from jsonb_object_keys(col) k where k not in ('key','header')) or coalesce(col->>'key','') not in ('external_id','employee_number','name','week','regular_hours','overtime_hours','paid_hours','credited_hours','premium_amount','credit_amount','estimated_amount') or length(trim(coalesce(col->>'header',''))) not between 1 and 80 or col->>'header' ~ '[[:cntrl:]]' then raise exception 'Colonne invalide';end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p_columns) c where c->>'key'='external_id') or exists(select 1 from jsonb_array_elements(p_columns) c group by c->>'header' having count(*)>1) or exists(select 1 from jsonb_array_elements(p_columns) c group by c->>'key' having count(*)>1) then raise exception 'Identifiant externe requis et colonnes uniques';end if;
 if p_id is not null then select * into old from public.essential_payroll_export_profiles where company_id=p_company and id=p_id for update; if not found then raise exception 'Profil introuvable';end if; end if;
 if coalesce(old.version,0) is distinct from p_version then raise exception 'Profil modifié : actualiser';end if;
 if p_id is null then insert into public.essential_payroll_export_profiles(company_id,name,columns,delimiter,active,updated_by) values(p_company,trim(p_name),p_columns,p_delimiter,p_active,auth.uid()) returning id into result;
 else update public.essential_payroll_export_profiles set name=trim(p_name),columns=p_columns,delimiter=p_delimiter,active=p_active,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning id into result;end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(p_company,auth.uid(),'payroll_export_profile_saved',result,trim(p_reason));return result;
end $$;
create function public.save_payroll_worker_mapping(p_profile uuid,p_worker uuid,p_external text,p_version integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare profile public.essential_payroll_export_profiles;old public.essential_payroll_worker_mappings;
begin
 select * into profile from public.essential_payroll_export_profiles where id=p_profile for share;if not found then raise exception 'Profil introuvable';end if;
 perform private.essential_assert_compensation(profile.company_id);
 if not private.essential_feature(profile.company_id,'payroll_integrations') or not exists(select 1 from public.company_workers where company_id=profile.company_id and id=p_worker) then raise exception using errcode='42501',message='Correspondance non autorisée';end if;
 if length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Motif requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-mapping:'||p_profile::text||p_worker::text,0));
 select * into old from public.essential_payroll_worker_mappings where profile_id=p_profile and worker_id=p_worker;
 if coalesce(old.version,0) is distinct from p_version then raise exception 'Correspondance modifiée : actualiser';end if;
 insert into public.essential_payroll_worker_mappings(company_id,profile_id,worker_id,external_id,updated_by) values(profile.company_id,p_profile,p_worker,trim(p_external),auth.uid()) on conflict(profile_id,worker_id) do update set external_id=excluded.external_id,version=essential_payroll_worker_mappings.version+1,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(profile.company_id,auth.uid(),'payroll_worker_mapping_saved',p_worker,trim(p_reason));
end $$;
create function public.prepare_payroll_export(p_profile uuid,p_profile_version integer,p_estimate uuid,p_request uuid) returns public.essential_payroll_export_runs language plpgsql security definer set search_path='' as $$
declare profile public.essential_payroll_export_profiles; estimate public.essential_payroll_estimates; current_estimate public.essential_payroll_estimates; result public.essential_payroll_export_runs; rows jsonb:='[]';r jsonb;external text;item jsonb;
begin
 select * into profile from public.essential_payroll_export_profiles where id=p_profile for share;if not found then raise exception 'Profil introuvable';end if;
 perform private.essential_assert_compensation(profile.company_id,false);
 if not private.essential_feature(profile.company_id,'payroll_integrations') then raise exception using errcode='42501',message='Module intégrations de paie requis';end if;
 if p_request is null then raise exception 'Identifiant de préparation requis';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-export:'||profile.company_id::text||p_request::text,0));
 select * into result from public.essential_payroll_export_runs where company_id=profile.company_id and request_id=p_request;
 if found then if result.created_by is distinct from auth.uid() or result.profile_id is distinct from p_profile or result.estimate_id is distinct from p_estimate or (result.payload->>'profile_version')::integer is distinct from p_profile_version then raise exception 'Identifiant de préparation réutilisé';end if;return result;end if;
 if not profile.active or profile.version is distinct from p_profile_version then raise exception 'Profil désactivé ou modifié : actualiser';end if;
 select * into estimate from public.essential_payroll_estimates where id=p_estimate and company_id=profile.company_id;if not found then raise exception 'Rapport introuvable';end if;
 -- Same lock as close/reopen; no new official time or supplier transmission.
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||profile.company_id::text,0));
 perform 1 from public.payroll_weeks where company_id=profile.company_id and week_start=estimate.week_start and reopened_at is null for share;
 if not found then raise exception 'Fermer la semaine avant de préparer un export de paie';end if;
 current_estimate:=public.generate_essential_payroll_estimate(profile.company_id,estimate.week_start);
 if (current_estimate.payload-'generated_at') is distinct from (estimate.payload-'generated_at') then raise exception 'Rapport périmé : régénérer avant export';end if;
 for r in select value from jsonb_array_elements(estimate.payload->'rows') loop
 if coalesce((r->>'missing_rate')::boolean,true) or coalesce((r->>'open_punch')::boolean,true) or r->>'estimated_cents' is null then raise exception 'Rapport incomplet : taux ou sortie manquants';end if;
 -- Exclude empty records; every nonzero source must have an explicit correspondence.
 if (r->>'paid_seconds')::numeric=0 and (r->>'credited_hours')::numeric=0 and (r->>'credit_amount_cents')::numeric=0 and (r->>'estimated_cents')::numeric=0 then continue;end if;
 select external_id into external from public.essential_payroll_worker_mappings where company_id=profile.company_id and profile_id=profile.id and worker_id=(r->>'worker_id')::uuid for share;
 if not found then raise exception 'Matricule externe manquant pour %',r->>'employee_number';end if;
 item:=jsonb_build_object('external_id',external,'employee_number',r->>'employee_number','name',r->>'name','week',estimate.week_start,'regular_hours',round(((r->>'paid_seconds')::numeric-(r->>'overtime_seconds')::numeric)/3600,4),'overtime_hours',round((r->>'overtime_seconds')::numeric/3600,4),'paid_hours',round((r->>'paid_seconds')::numeric/3600,4),'credited_hours',(r->>'credited_hours')::numeric,'premium_amount',round((r->>'premium_cents')::numeric/100,2),'credit_amount',round((r->>'credit_amount_cents')::numeric/100,2),'estimated_amount',round((r->>'estimated_cents')::numeric/100,2)); rows:=rows||jsonb_build_array(item);
 end loop;
 if jsonb_array_length(rows)=0 then raise exception 'Aucune heure ou indemnité à exporter';end if;
 insert into public.essential_payroll_export_runs(company_id,profile_id,estimate_id,request_id,created_by,payload) values(profile.company_id,profile.id,estimate.id,p_request,auth.uid(),jsonb_build_object('profile_name',profile.name,'profile_version',profile.version,'columns',profile.columns,'delimiter',profile.delimiter,'week',estimate.week_start,'timezone',estimate.payload->>'timezone','rule_version',estimate.payload->'rule_version','rows',rows,'notice','Fichier préparatoire estimatif à valider selon le format du fournisseur; aucune transmission ni calcul de retenues.')) returning * into result;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(profile.company_id,auth.uid(),'payroll_export_prepared',result.id,jsonb_build_object('profile',profile.id,'version',profile.version,'estimate',estimate.id,'rows',jsonb_array_length(rows)),'Préparation auditable de fichier sans transmission fournisseur');return result;
end $$;
revoke all on function public.save_payroll_export_profile(uuid,uuid,integer,text,jsonb,text,boolean,text),public.save_payroll_worker_mapping(uuid,uuid,text,integer,text),public.prepare_payroll_export(uuid,integer,uuid,uuid) from public,anon;
grant execute on function public.save_payroll_export_profile(uuid,uuid,integer,text,jsonb,text,boolean,text),public.save_payroll_worker_mapping(uuid,uuid,text,integer,text),public.prepare_payroll_export(uuid,integer,uuid,uuid) to authenticated;
create index payroll_export_profiles_company on public.essential_payroll_export_profiles(company_id);
create index payroll_mappings_worker on public.essential_payroll_worker_mappings(company_id,worker_id);
create index payroll_export_runs_company on public.essential_payroll_export_runs(company_id,created_at desc);
