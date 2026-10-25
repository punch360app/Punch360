begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;r jsonb;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '5 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);execute 'set local role authenticated';
 c:=public.platform_create_test_company('Service filter rollback fixture','essential',5);
 r:=public.platform_set_company_service(c,true,null,0,c::text,'Synthetic service filter validation');if r->>'effective_status'<>'restricted' then raise exception 'Hold ignored';end if;
 if jsonb_array_length(public.platform_search_companies(c::text,'essential',true,'restricted')->'items')<>1 or jsonb_array_length(public.platform_search_companies(c::text,'essential',true,'active')->'items')<>0 then raise exception 'Effective status filter mismatch';end if;
 r:=public.platform_set_company_service(c,false,null,1,c::text,'Synthetic release validation');
end $$;
rollback;
