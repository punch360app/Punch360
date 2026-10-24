begin;
do $$
declare owner_id uuid:=gen_random_uuid(); office_id uuid:=gen_random_uuid(); worker_id uuid:=gen_random_uuid(); c uuid; j uuid; denied boolean; r jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(owner_id,owner_id||'@test.invalid',now()),(office_id,office_id||'@test.invalid',now()),(worker_id,worker_id||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',owner_id::text,true);c:=public.create_my_company('Office role regression');
 insert into public.company_members(company_id,user_id,role) values(c,office_id,'admin'),(c,worker_id,'employee');
 insert into public.jobs(company_id,number,name) values(c,'ROLE','Test') returning id into j;
 perform set_config('request.jwt.claim.sub',office_id::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.punch_with_location(c,'in',j);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Admin online punch permitted';end if;
 denied:=false;begin perform public.sync_punch_event(gen_random_uuid(),c,'in',now(),true,j);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Admin offline punch permitted';end if;
 denied:=false;begin perform public.sync_break_event(gen_random_uuid(),c,'break_start',now(),true);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Admin break permitted';end if;
 if (select count(*) from public.punch_sessions where company_id=c)<>0 then raise exception 'Denied request mutated time ledger';end if;
 -- Administrative job editing remains permitted under actual authenticated RLS.
 update public.jobs set punch_radius_m=250 where id=j;
 if (select punch_radius_m from public.jobs where id=j)<>250 then raise exception 'Admin management broken';end if;
 perform set_config('request.jwt.claim.sub',worker_id::text,true);
 r:=public.punch_with_location(c,'in',j);r:=public.punch_with_location(c,'out');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 r:=public.punch_with_location(c,'in',j);r:=public.punch_with_location(c,'out');
 execute 'reset role';
end $$;
rollback;
