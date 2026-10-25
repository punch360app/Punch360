begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();prefix text:='Directory fixture '||gen_random_uuid()::text;ids uuid[]:='{}';c uuid;result jsonb;next_page jsonb;denied boolean;i integer;
begin
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');insert into auth.users(id,email,email_confirmed_at) values(outsider,outsider||'@directory.test.invalid',now());
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);execute 'set local role authenticated';
 for i in 1..56 loop c:=public.platform_create_test_company(prefix||' · '||i,'essential',5);ids:=array_append(ids,c);end loop;
 result:=public.platform_search_companies(prefix,'essential',true);if jsonb_array_length(result->'items')<>50 or not (result->>'has_more')::boolean then raise exception 'Missing first directory page';end if;
 next_page:=public.platform_search_companies(prefix,'essential',true,null,(result->>'before')::timestamptz,(result->>'before_id')::uuid);if jsonb_array_length(next_page->'items')<>6 or (next_page->>'has_more')::boolean then raise exception 'Missing continuation';end if;
 if exists(select 1 from jsonb_array_elements(result->'items') a join jsonb_array_elements(next_page->'items') b on a->>'id'=b->>'id') then raise exception 'Directory pages duplicate rows';end if;
 if jsonb_array_length(public.platform_search_companies(prefix,'construction',true)->'items')<>0 or jsonb_array_length(public.platform_search_companies(prefix,'essential',false)->'items')<>0 then raise exception 'Edition or test filter ignored';end if;
 execute 'reset role';perform set_config('request.jwt.claim.sub',outsider::text,true);execute 'set local role authenticated';denied:=false;begin perform public.platform_search_companies(prefix);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Non-owner directory leak';end if;execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=sid;execute 'set local role authenticated';denied:=false;begin perform public.platform_snapshot();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Expired legacy platform session accepted';end if;execute 'reset role';
 delete from auth.sessions where id=sid;execute 'set local role authenticated';denied:=false;begin perform public.platform_create_test_company('Revoked session must fail','essential',5);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked MFA token mutated legacy platform endpoint';end if;execute 'reset role';
end $$;
rollback;
