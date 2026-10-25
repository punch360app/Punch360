-- Recover cleanup controls after a browser restart; never return archive contents here.
create function public.company_archive_pending(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_company_archive_access(p_company);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'expires_at',expires_at) order by created_at) from private.company_exports where actor_id=auth.uid() and company_id=p_company and expires_at>clock_timestamp()),'[]'::jsonb);
end $$;
revoke all on function public.company_archive_pending(uuid) from public,anon;
grant execute on function public.company_archive_pending(uuid) to authenticated;
-- Report every excluded collection, including archive-only security and billing history.
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_restore_apply(jsonb,uuid)'::regprocedure);
 changed:=replace(source,' insert into private.company_restore_context',
 $replacement$ select coalesce(sum(jsonb_array_length(value)),0) into skipped from jsonb_each(p->'collections') where not key=any(array(select 'public.'||unnest(private.company_restore_tables())));
 insert into private.company_restore_context$replacement$);
 if changed=source then raise exception 'Recovery engine changed: inspect before migration';end if;
 execute changed;
end $migration$;
