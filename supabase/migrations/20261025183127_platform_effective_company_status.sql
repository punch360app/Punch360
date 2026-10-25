-- Search/filter and detail agree on the calculated service status; raw Stripe/cache is preserved.
do $$
declare source text;modified text;
begin
 source:=pg_get_functiondef('public.platform_search_companies(text,text,boolean,text,timestamptz,uuid)'::regprocedure);
 modified:=replace(source,'billing_mode,billing_status,seat_limit','billing_mode,billing_status as base_billing_status,case when product_edition=''essential'' then private.essential_billing_state(id) else billing_status end as billing_status,seat_limit');
 modified:=replace(modified,'(p_status is null or billing_status=p_status)','(p_status is null or case when product_edition=''essential'' then private.essential_billing_state(id) else billing_status end=p_status)');
 if modified=source or position('base_billing_status' in modified)=0 then raise exception 'Company search source changed';end if;execute modified;
end $$;
