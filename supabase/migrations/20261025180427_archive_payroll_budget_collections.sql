-- Extend the existing single-statement archive and additive recovery, never keys/tokens.
do $$
declare source text;modified text;table_name text;extra text:='';
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 foreach table_name in array array['essential_labor_budgets','essential_budget_evaluations','essential_payroll_export_profiles','essential_payroll_worker_mappings','essential_payroll_export_runs'] loop
 if position('public.'||table_name in source)>0 then raise exception 'Archive collection already included: %',table_name;end if;
 extra:=extra||format('union all select %L as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.%I t where company_id=p_company) source),''[]''::jsonb) as rows ', 'public.'||table_name,table_name);
 end loop;
 modified:=replace(source,') collections),',extra||') collections),');
 if modified=source then raise exception 'Archive source changed; review collection insertion';end if;execute modified;
 source:=pg_get_functiondef('private.company_restore_tables()'::regprocedure);
 modified:=replace(source,'''workforce_audit'']','''essential_labor_budgets'',''essential_budget_evaluations'',''essential_payroll_export_profiles'',''essential_payroll_worker_mappings'',''essential_payroll_export_runs'',''workforce_audit'']');
 if modified=source then raise exception 'Recovery collection source changed';end if;execute modified;
 source:=pg_get_functiondef('private.company_restore_rows(jsonb,text,uuid)'::regprocedure);
 modified:=replace(source,'case when t=''company_workers''','case when t=''essential_payroll_export_profiles'' then value||jsonb_build_object(''active'',false) when t=''company_workers''');
 if modified=source then raise exception 'Recovery row source changed';end if;execute modified;
end $$;
