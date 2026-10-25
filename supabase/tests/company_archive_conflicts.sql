-- Only synthetic records are changed; this transaction is always rolled back.
begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;w uuid:=gen_random_uuid();s uuid:=gen_random_uuid();ex uuid:=gen_random_uuid();h jsonb;p jsonb;plan jsonb;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 c:=public.platform_create_test_company('Archive unique fixture','essential',10);
 insert into public.company_workers(id,company_id,employee_number,first_name) values(w,c,'DUPLICATE','Original');
 insert into public.punch_sessions(id,company_id,worker_id,started_at,ended_at) values(s,c,w,'2026-10-19 12:00Z','2026-10-19 13:00Z');
 execute 'set local role authenticated';h:=public.company_export_create(c,ex,'Conflict fixture');execute 'reset role';
 delete from public.punch_sessions where id=s;delete from public.company_workers where id=w;
 insert into public.company_workers(company_id,employee_number,first_name) values(c,'DUPLICATE','New current employee');
 execute 'set local role authenticated';plan:=public.company_restore_plan(ex);
 if (plan->>'conflicts')::int<1 or (plan->>'blocked')::int<1 then raise exception 'Unique conflict or missing parent not reported: %',plan;end if;
 perform public.company_restore_missing(ex,plan->>'plan_hash',plan->>'company_name','Conflict recovery fixture',gen_random_uuid());
 execute 'reset role';
 if exists(select 1 from public.company_workers where id=w) or exists(select 1 from public.punch_sessions where id=s) then raise exception 'Duplicate or orphan inserted';end if;
 if not exists(select 1 from public.company_workers where company_id=c and first_name='New current employee' and status='active') then raise exception 'Current worker altered';end if;
 update private.company_exports set expires_at=now()-interval '1 second' where id=ex;
 delete from private.company_exports where id=ex and expires_at<now();
 if exists(select 1 from private.company_exports where id=ex) then raise exception 'Expired copy not purged';end if;
 if not exists(select 1 from cron.job where jobname='punch-expired-company-exports' and active and schedule='*/15 * * * *') then raise exception 'Periodic purge not configured';end if;
end $$;
rollback;
