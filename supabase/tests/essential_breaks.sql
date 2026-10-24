begin;
do $$
declare boss uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid(); c uuid; j uuid; r jsonb; e1 uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); e3 uuid:=gen_random_uuid(); e4 uuid:=gen_random_uuid(); t timestamptz:=clock_timestamp()-interval '6 hours'; session_id uuid; denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(worker,worker||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Office test','essential');
 select default_punch_job_id into j from public.companies where id=c and product_edition='essential';if j is null then raise exception 'Missing essential default workplace';end if;
 update public.jobs set latitude=46.8,longitude=-71.2 where id=j;
 insert into public.company_members(company_id,user_id,role) values(c,worker,'employee');
 perform set_config('request.jwt.claim.sub',worker::text,true);
 r:=public.sync_punch_event(e1,c,'in',t,true,j,46.8,-71.2,5,null);session_id:=(r->>'session_id')::uuid;
 r:=public.sync_break_event(e2,c,'break_start',t+interval '2 hours',true,e1);if r->>'sync_status'<>'synced' then raise exception 'Pause failed %',r;end if;
 r:=public.sync_break_event(e3,c,'break_end',t+interval '2 hours 30 minutes',true,e2);if r->>'sync_status'<>'synced' then raise exception 'Resume failed %',r;end if;
 r:=public.sync_punch_event(e4,c,'out',t+interval '4 hours',true,null,46.8,-71.2,5,e3);if r->>'sync_status'<>'synced' then raise exception 'OUT after pause failed %',r;end if;
 if (select sum(extract(epoch from ended_at-started_at)) from public.punch_breaks where company_id=c)<>1800 then raise exception 'Pause duration incorrect';end if;
 r:=public.sync_break_event(e3,c,'break_end',t+interval '2 hours 30 minutes',true,e2);
 if (select count(*) from public.punch_breaks where company_id=c)<>1 then raise exception 'Pause duplicated';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.review_break_event(c,worker,e2,'Verified offline pause');perform public.review_break_event(c,worker,e3,'Verified offline resume');
 -- Product isolation: Essential cannot create orders through the Data API.
 execute 'set local role authenticated';denied:=false;begin insert into public.material_orders(company_id,job_id,created_by,note) values(c,j,boss,'Not included');exception when others then denied:=true;end;
 if not denied then raise exception 'Essential order creation allowed';end if;
 execute 'reset role';
end $$;
rollback;
