begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();object_id uuid:=gen_random_uuid();data jsonb;denied boolean;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(owner_id,'fixture_audit_created',object_id,'{"reason":"first"}'),(owner_id,'fixture_audit_updated',object_id,'{"reason":"second"}');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 execute 'set local role authenticated';
 data:=public.platform_search_audit('fixture_audit_',object_id);
 if jsonb_array_length(data)<>2 then raise exception 'Missing filtered audit';end if;
 if jsonb_array_length(public.platform_search_audit('fixture_audit_created',object_id))<>1 then raise exception 'Wrong action filter';end if;
 data:=public.platform_search_audit('fixture_audit_',object_id,null,null,(data->0->>'created_at')::timestamptz,(data->0->>'id')::uuid);
 if jsonb_array_length(data)<>1 then raise exception 'Cursor lost tied timestamp';end if;
 denied:=false;begin perform public.platform_search_audit('',null,now(),now()-interval '1 day');exception when others then denied:=true;end;if not denied then raise exception 'Bad date range accepted';end if;
 execute 'reset role';delete from auth.sessions where id=sid;execute 'set local role authenticated';
 denied:=false;begin perform public.platform_search_audit();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked session accepted';end if;
 execute 'reset role';
end $$;
rollback;
