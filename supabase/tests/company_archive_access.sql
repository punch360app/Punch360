-- Fictional companies and a fictional boss. Every write below is rolled back.
begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;c2 uuid;u uuid:=gen_random_uuid();us uuid:=gen_random_uuid();denied boolean;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 c:=public.platform_create_test_company('Archive access fixture A','essential',10);c2:=public.platform_create_test_company('Archive access fixture B','essential',10);
 insert into auth.users(id,email,email_confirmed_at) values(u,'archive-'||u||'@punch360.test.invalid',now());perform public.platform_register_test_user(owner_id,u,c2,'boss');
 insert into auth.sessions(id,user_id,aal,not_after) values(us,u,'aal1',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal1','session_id',us)::text,true);
 execute 'set local role authenticated';denied:=false;begin perform public.company_export_create(c,gen_random_uuid(),'Wrong tenant');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Cross tenant export';end if;
 perform public.company_export_create(c2,gen_random_uuid(),'Boss allowed');
 execute 'reset role';delete from auth.sessions where id=us;execute 'set local role authenticated';denied:=false;begin perform public.company_export_create(c2,gen_random_uuid(),'Revoked boss');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked boss allowed';end if;
 execute 'reset role';
end $$;
rollback;
