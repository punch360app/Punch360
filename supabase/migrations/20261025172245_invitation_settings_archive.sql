do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$select 'public.essential_schedule_templates' as collection$old$,$new$select 'public.invitation_delivery_settings' as collection,coalesce((select jsonb_agg(to_jsonb(t)) from public.invitation_delivery_settings t where company_id=p_company),'[]'::jsonb) as rows
union all
select 'public.essential_schedule_templates' as collection$new$);
 if changed=source then raise exception 'Archive payload source changed';end if;execute changed;
end $migration$;
