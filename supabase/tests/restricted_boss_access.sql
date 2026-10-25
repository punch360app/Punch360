-- READ BEFORE RUN: Synthetic accounts/company only, one transaction, rolled back.
begin;
do $$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();
owner_id uuid;sid uuid:=gen_random_uuid();company_id uuid;job_id uuid;response jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@restriction.test.invalid',clock_timestamp()),
       (emp,emp||'@restriction.test.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company_id:=public.create_company_for_edition('Restricted boss test rollback','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=company_id;
 insert into public.company_members(company_id,user_id,role) values(company_id,emp,'employee');
 select default_punch_job_id into job_id from public.companies where id=company_id;
 select user_id into owner_id from private.platform_owner limit 1;
 insert into auth.sessions(id,user_id,aal,not_after)
 values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 response:=public.platform_set_company_service(company_id,true,null,0,company_id::text,'Rollback access test');
 if response->>'effective_status'<>'restricted' then raise exception 'Company hold not effective';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 response:=public.essential_billing_summary(company_id);
 if response->>'status'<>'restricted' then raise exception 'Boss cannot see effective billing hold';end if;
 response:=public.essential_entitlements(company_id);
 if response->>'billing_status'<>'restricted' or (response->>'can_administer')::boolean then raise exception 'Entitlement unexpectedly allows management';end if;
 response:=public.support_list_tickets(company_id);
 if jsonb_typeof(response)<>'array' then raise exception 'Support not accessible during hold';end if;
 if private.can_administer(company_id) then raise exception 'Restricted Boss still can administer';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 response:=public.sync_punch_event(gen_random_uuid(),company_id,'in',clock_timestamp(),false,job_id,null,null,null,null);
 if response->>'sync_status'<>'synced' then raise exception 'Employee punch in rejected';end if;
 response:=public.sync_punch_event(gen_random_uuid(),company_id,'out',clock_timestamp(),false,null,null,null,null,null);
 if response->>'sync_status'<>'synced' then raise exception 'Employee punch out rejected';end if;
 execute 'reset role';
end $$;
rollback;
