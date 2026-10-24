begin;
do $$
declare owner_id uuid;c uuid;denied boolean;
begin
 select user_id into owner_id from private.platform_owner;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal1')::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.platform_create_test_company('MFA test','essential',10);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Legacy platform mutation bypasses MFA';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2')::text,true);
 c:=public.platform_create_test_company('MFA test','essential',10);
 execute 'reset role';
 if not exists(select 1 from public.companies where id=c and is_test and billing_mode='test_simulated' and product_edition='essential') then raise exception 'Test company is not isolated';end if;
 if exists(select 1 from public.company_members where company_id=c) then raise exception 'Super Admin added as billable test member';end if;
end $$;
rollback;
