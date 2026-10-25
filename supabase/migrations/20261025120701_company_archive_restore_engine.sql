-- Same insert engine for preview (rolled back below) and application.
create function private.company_restore_apply(p jsonb,c uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text;rows jsonb;x jsonb;existing jsonb;pk text;scope text;added integer;n bigint:=0;conflicts bigint:=0;same bigint:=0;blocked bigint:=0;skipped bigint:=0;table_result jsonb;tables jsonb:='[]';reason text;
begin
 insert into private.company_restore_context values(txid_current(),c,auth.uid());
 foreach t in array private.company_restore_tables() loop
  rows:=private.company_restore_rows(p,t,c);table_result:=jsonb_build_object('name',t,'restored',0,'conflicts',0,'unchanged',0,'blocked',0);
  skipped:=skipped+jsonb_array_length(coalesce(p->'collections'->('public.'||t),'[]'::jsonb))-jsonb_array_length(rows);
  select string_agg(format('e.%1$I=x.%1$I',a.attname),' and ') into pk from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=to_regclass('public.'||t) and i.indisprimary;
  if pk is null then raise exception 'Clé de collection manquante';end if;
  for x in select value from jsonb_array_elements(rows) loop
   execute format('select to_jsonb(e) from public.%I e,jsonb_populate_record(null::public.%I,$1) x where %s',t,t,pk) into existing using x;
   if existing is not null then
    if existing=x then same:=same+1;table_result:=jsonb_set(table_result,'{unchanged}',to_jsonb((table_result->>'unchanged')::int+1));
    else conflicts:=conflicts+1;table_result:=jsonb_set(table_result,'{conflicts}',to_jsonb((table_result->>'conflicts')::int+1));end if;
    continue;
   end if;
   if not private.company_restore_reference_ok(t,x,c) then
    blocked:=blocked+1;table_result:=jsonb_set(table_result,'{blocked}',to_jsonb((table_result->>'blocked')::int+1));continue;
   end if;
   begin
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) on conflict do nothing',t,t) using x;
    get diagnostics added=row_count;
    if added=1 then n:=n+1;table_result:=jsonb_set(table_result,'{restored}',to_jsonb((table_result->>'restored')::int+1));
    else conflicts:=conflicts+1;table_result:=jsonb_set(table_result,'{conflicts}',to_jsonb((table_result->>'conflicts')::int+1));end if;
   exception when integrity_constraint_violation or raise_exception then
    blocked:=blocked+1;table_result:=jsonb_set(table_result,'{blocked}',to_jsonb((table_result->>'blocked')::int+1));
   end;
  end loop;
  tables:=tables||jsonb_build_array(table_result);
 end loop;
 delete from private.company_restore_context where tx=txid_current();
 return jsonb_build_object('restored',n,'conflicts',conflicts,'unchanged',same,'blocked',blocked,'policy_skipped',skipped,'tables',tables);
end $$;
revoke all on function private.company_restore_apply(jsonb,uuid) from public,anon,authenticated;
