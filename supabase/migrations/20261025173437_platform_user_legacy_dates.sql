do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.platform_search_users(text,text,uuid,boolean,text,timestamptz,uuid)'::regprocedure);
 changed:=replace(source,'u.id,u.email,u.created_at,u.email_confirmed_at','u.id,u.email,coalesce(u.created_at,''1970-01-01Z''::timestamptz) as created_at,u.email_confirmed_at');
 changed:=replace(changed,'(u.created_at,u.id)<','(coalesce(u.created_at,''1970-01-01Z''::timestamptz),u.id)<');
 changed:=replace(changed,'order by u.created_at desc,u.id desc','order by coalesce(u.created_at,''1970-01-01Z''::timestamptz) desc,u.id desc');
 if changed=source then raise exception 'Directory user date source changed';end if;execute changed;
end $migration$;
