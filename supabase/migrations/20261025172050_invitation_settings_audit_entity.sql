do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.set_invitation_delivery_settings(uuid,boolean,integer,integer)'::regprocedure);
 changed:=replace(source,'workforce_audit(company_id,actor_id,action,before_value,after_value,reason) values(p_company,auth.uid(),''invitation_delivery_settings'',','workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(p_company,auth.uid(),''invitation_delivery_settings'',p_company,');
 if changed=source then raise exception 'Settings audit source changed';end if;execute changed;
end $migration$;
