begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();prefix text:='Subscription fixture '||gen_random_uuid();c uuid;result jsonb;next_page jsonb;i integer;denied boolean;
begin
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '5 minutes');perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 for i in 1..52 loop
 c:=public.platform_create_test_company(prefix||' · '||i,'essential',5);
 insert into private.essential_billing_accounts(company_id,subscription_id,status,paid_through) values(c,'sub_directory_'||c,'active',clock_timestamp()+interval '10 days');
 end loop;
 execute 'set local role authenticated';result:=public.platform_subscription_directory('Synthetic pagination',prefix,true);
 if jsonb_array_length(result->'items')<>50 or not (result->>'has_more')::boolean or (result->'summary'->>'count')::integer<>52 or (result->'summary'->>'unpriced_active')::integer<>52 or result->'summary'->>'mrr_cents' is not null then raise exception 'Directory counts or incomplete MRR incorrect';end if;
 next_page:=public.platform_subscription_directory('Synthetic pagination',prefix,true,null,null,null,(result->>'before')::timestamptz,(result->>'before_id')::uuid);
 if jsonb_array_length(next_page->'items')<>2 or (next_page->>'has_more')::boolean then raise exception 'Directory continuation incorrect';end if;
 if exists(select 1 from jsonb_array_elements(result->'items') a join jsonb_array_elements(next_page->'items') b on a->>'id'=b->>'id') then raise exception 'Directory duplicate rows';end if;
 if jsonb_array_length(public.platform_subscription_directory('Synthetic real separation',prefix,false)->'items')<>0 then raise exception 'Test accounts leaked to real';end if;
 denied:=false;begin perform public.platform_subscription_directory('',prefix,true);exception when others then denied:=true;end;if not denied then raise exception 'Purpose omitted';end if;
 execute 'reset role';update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=sid;execute 'set local role authenticated';denied:=false;begin perform public.platform_subscription_directory('Synthetic expired session',prefix,true);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Expired session accepted';end if;execute 'reset role';
end $$;
rollback;
