do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.save_department_break_policy(uuid,uuid,integer,text,integer,integer,text,timestamptz)'::regprocedure);
 changed:=replace(source,'v integer;id uuid;','v integer;result_id uuid;');
 changed:=replace(changed,'returning essential_break_policies.id into id;','returning essential_break_policies.id into result_id;');
 changed:=replace(changed,$old$'department_break_policy_version',id,$old$,$new$'department_break_policy_version',result_id,$new$);
 changed:=replace(changed,'return id;','return result_id;');
 if changed=source then raise exception 'Policy source changed: inspect before migration';end if;execute changed;
end $migration$;
