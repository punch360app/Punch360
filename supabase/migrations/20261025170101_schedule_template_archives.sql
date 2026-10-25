-- Include presets in signed exports; recovery is archive-only to avoid reactivating planning scope.
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$select 'public.essential_break_policies' as collection$old$,$new$select 'public.essential_schedule_templates' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_schedule_templates t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_break_policies' as collection$new$);
 if changed=source then raise exception 'Archive payload source changed';end if;execute changed;
end $migration$;
