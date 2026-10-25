create table public.essential_labor_budgets(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),department_id uuid,
 week_start date not null check(extract(isodow from week_start)=1),amount_cents bigint not null check(amount_cents between 0 and 100000000000),
 version integer not null default 1,reason text not null check(length(trim(reason)) between 3 and 1000),updated_by uuid not null,updated_at timestamptz not null default now(),
 unique nulls not distinct(company_id,week_start,department_id),unique(company_id,id),foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
alter table public.essential_labor_budgets enable row level security;
create policy labor_budgets_compensation on public.essential_labor_budgets for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') and private.essential_feature(company_id,'labor_costs'));
grant select on public.essential_labor_budgets to authenticated;
revoke insert,update,delete on public.essential_labor_budgets from anon,authenticated;
create table public.essential_budget_evaluations(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),budget_id uuid not null,
 payroll_estimate_id uuid not null,payload jsonb not null,created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(company_id,budget_id) references public.essential_labor_budgets(company_id,id),foreign key(payroll_estimate_id) references public.essential_payroll_estimates(id)
);
create index budget_evaluations_company on public.essential_budget_evaluations(company_id,created_at desc);
alter table public.essential_budget_evaluations enable row level security;
create policy budget_evaluations_compensation on public.essential_budget_evaluations for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') and private.essential_feature(company_id,'labor_costs'));
grant select on public.essential_budget_evaluations to authenticated;
revoke insert,update,delete on public.essential_budget_evaluations from anon,authenticated;
create function public.save_essential_labor_budget(p_company uuid,p_department uuid,p_week date,p_amount bigint,p_expected_version integer,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.essential_labor_budgets;result uuid;
begin
 perform private.essential_assert_compensation(p_company);
 if not private.essential_feature(p_company,'labor_costs') then raise exception using errcode='42501',message='Module coûts requis';end if;
 if p_week is null or extract(isodow from p_week)<>1 or p_amount is null or p_amount not between 0 and 100000000000 or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Lundi, budget positif ou nul et motif requis';end if;
 if p_department is not null and not exists(select 1 from public.essential_departments where company_id=p_company and id=p_department and active) then raise exception 'Département invalide';end if;
 perform pg_advisory_xact_lock(hashtextextended('labor-budget:'||p_company::text||p_week::text||coalesce(p_department::text,'all'),0));
 select * into old from public.essential_labor_budgets where company_id=p_company and week_start=p_week and department_id is not distinct from p_department for update;
 if coalesce(old.version,0) is distinct from p_expected_version then raise exception 'Budget modifié : actualiser';end if;
 insert into public.essential_labor_budgets(company_id,department_id,week_start,amount_cents,reason,updated_by) values(p_company,p_department,p_week,p_amount,trim(p_reason),auth.uid())
 on conflict(company_id,week_start,department_id) do update set amount_cents=excluded.amount_cents,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=clock_timestamp(),version=essential_labor_budgets.version+1 returning id into result;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(p_company,auth.uid(),'labor_budget_saved',result,to_jsonb(old),jsonb_build_object('week',p_week,'department',p_department,'amount_cents',p_amount),trim(p_reason));return result;
end $$;
create function public.evaluate_essential_labor_budget(p_budget uuid) returns public.essential_budget_evaluations language plpgsql security definer set search_path='' as $$
declare b public.essential_labor_budgets;estimate public.essential_payroll_estimates;outcome public.essential_budget_evaluations;rows jsonb;known numeric;incomplete boolean;missing_count integer;open_count integer;planned_seconds numeric;vacant integer;begins timestamptz;ends timestamptz;result jsonb;
begin
 select * into b from public.essential_labor_budgets where id=p_budget for share;
 if not found then raise exception 'Budget introuvable';end if;
 perform private.essential_assert_compensation(b.company_id,false);
 if not private.essential_feature(b.company_id,'labor_costs') then raise exception using errcode='42501',message='Module coûts requis';end if;
 -- Reuse the rate, premium, overtime, paid-break and credit engine unchanged.
 estimate:=public.generate_essential_payroll_estimate(b.company_id,b.week_start);
 select coalesce(jsonb_agg(value),'[]'),coalesce(sum((value->>'estimated_cents')::numeric),0),count(*) filter(where (value->>'missing_rate')::boolean),count(*) filter(where (value->>'open_punch')::boolean) into rows,known,missing_count,open_count from jsonb_array_elements(estimate.payload->'rows') where b.department_id is null or (value->>'department_id')::uuid=b.department_id;
 incomplete:=missing_count>0 or open_count>0;
 begins:=b.week_start::timestamp at time zone (estimate.payload->>'timezone');ends:=(b.week_start+7)::timestamp at time zone (estimate.payload->>'timezone');
 select coalesce(sum(extract(epoch from least(ends_at,ends)-greatest(starts_at,begins))),0),count(*) filter(where worker_id is null) into planned_seconds,vacant from public.scheduled_shifts where company_id=b.company_id and cancelled_at is null and starts_at<ends and ends_at>begins and (b.department_id is null or department_id=b.department_id);
 result:=jsonb_build_object('budget_id',b.id,'budget_version',b.version,'week',b.week_start,'department_id',b.department_id,'timezone',estimate.payload->>'timezone','currency','CAD','budget_cents',b.amount_cents,'known_estimate_cents',known,'estimated_cents',case when incomplete then null else known end,'variance_cents',case when incomplete then null else known-b.amount_cents end,'missing_rates',missing_count,'open_punches',open_count,'incomplete',incomplete,'planned_gross_seconds',planned_seconds,'vacant_shifts',vacant,'payroll_estimate_id',estimate.id,'payroll_rule_version',estimate.payload->'rule_version','week_closed',estimate.payload->'week_closed','rows',rows,'notice','Coûts bruts estimatifs des heures pointées, pas des décaissements. Affectations actuelles des dossiers, avant charges/retenues. Heures planifiées brutes incluant quarts vacants; aucune pause prévue ni coût planifié certifié.');
 insert into public.essential_budget_evaluations(company_id,budget_id,payroll_estimate_id,payload,created_by) values(b.company_id,b.id,estimate.id,result,auth.uid()) returning * into outcome;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(b.company_id,auth.uid(),'labor_budget_evaluated',outcome.id,jsonb_build_object('budget',b.id,'version',b.version,'estimate',estimate.id),'Comparaison conservée sans modifier les heures officielles');return outcome;
end $$;
revoke all on function public.save_essential_labor_budget(uuid,uuid,date,bigint,integer,text),public.evaluate_essential_labor_budget(uuid) from public,anon;
grant execute on function public.save_essential_labor_budget(uuid,uuid,date,bigint,integer,text),public.evaluate_essential_labor_budget(uuid) to authenticated;
