do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.kiosk_offline_issue(uuid,text,text,text)'::regprocedure);
 changed:=replace(source,$old$ return jsonb_build_object('ok',true,'person',person,$old$,$new$ person:=person||jsonb_build_object('break_policy',private.department_break_policy(d.company_id,w.id,clock_timestamp()));
 return jsonb_build_object('ok',true,'person',person,$new$);
 if changed=source then raise exception 'Offline identity source changed';end if;execute changed;
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$select 'public.essential_break_corrections' as collection$old$,$new$select 'public.essential_break_policies' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_break_policies t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_break_corrections' as collection$new$);
 if changed=source then raise exception 'Archive payload source changed';end if;execute changed;
 -- Adding metadata must not manufacture a conflict for already-issued offline grants.
 source:=pg_get_functiondef('private.kiosk_offline_baseline(uuid,uuid)'::regprocedure);
 changed:=replace(source,$old$jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.punch_breaks$old$,$new$jsonb_agg(to_jsonb(x)-'policy_snapshot' order by x.id),'[]') from public.punch_breaks$new$);
 if changed=source then raise exception 'Baseline source changed';end if;execute changed;
 source:=pg_get_functiondef('public.review_kiosk_offline(uuid,boolean,text)'::regprocedure);
 changed:=replace(source,'if current_baseline is distinct from g.baseline then',
 $new$if current_baseline is distinct from (case when g.baseline is null then null else jsonb_set(g.baseline,'{breaks}',(select coalesce(jsonb_agg(value-'policy_snapshot' order by value->>'id'),'[]'::jsonb) from jsonb_array_elements(g.baseline->'breaks'))) end) then$new$);
 if changed=source then raise exception 'Review baseline source changed';end if;execute changed;
end $migration$;
