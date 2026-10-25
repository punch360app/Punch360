begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;u uuid;prefix text:=replace(gen_random_uuid()::text,'-','');result jsonb;second jsonb;detail jsonb;denied boolean;i integer;
begin
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';c:=public.platform_create_test_company('User directory fixture','essential',10);execute 'reset role';
 for i in 1..52 loop insert into auth.users(id,email,email_confirmed_at,created_at,encrypted_password,raw_user_meta_data) values(gen_random_uuid(),prefix||i||'@user.test.invalid',now(),now(),'synthetic-hash','{"private_marker":"synthetic-private-value"}') returning id into u;end loop;
 insert into public.company_members(company_id,user_id,role) values(c,u,'employee');
 execute 'set local role authenticated';denied:=false;begin perform public.platform_search_users('',prefix);exception when others then denied:=true;end;if not denied then raise exception 'Missing purpose accepted';end if;
 result:=public.platform_search_users('Synthetic directory test',prefix);if jsonb_array_length(result->'items')<>50 or not (result->>'has_more')::boolean then raise exception 'User pagination first page';end if;
 second:=public.platform_search_users('Synthetic directory test',prefix,null,null,null,(result->>'before')::timestamptz,(result->>'before_id')::uuid);if jsonb_array_length(second->'items')<>2 then raise exception 'User pagination continuation';end if;
 if result::text like '%synthetic-hash%' or result::text like '%private_marker%' then raise exception 'Credential or metadata leak';end if;
 if jsonb_array_length(public.platform_search_users('Company filter test',prefix,c)->'items')<>1 then raise exception 'Company filter not applied';end if;
 detail:=public.platform_company_detail(c,'Synthetic support detail');if (detail->>'active_members')::integer<>1 or detail->>'id'<>c::text then raise exception 'Company detail incorrect';end if;
 execute 'reset role';if not exists(select 1 from private.platform_audit a where a.actor_id=owner_id and a.action='platform_users_read' and a.detail->>'reason'='Synthetic directory test') then raise exception 'Read purpose not audited';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';denied:=false;begin perform public.platform_company_detail(c,'Not owner');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Company member accessed platform detail';end if;execute 'reset role';
end $$;
rollback;
