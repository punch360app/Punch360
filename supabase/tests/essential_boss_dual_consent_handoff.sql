begin;
do $t$
declare boss uuid:=gen_random_uuid();successor uuid:=gen_random_uuid();stranger uuid:=gen_random_uuid();
 bsess uuid:=gen_random_uuid();ssess uuid:=gen_random_uuid();c uuid;other_c uuid;
 req uuid;version integer;result jsonb;denied boolean;
 reason text:='Transfert volontaire du Boss confirmé sur deux sessions MFA';
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@boss-transfer.invalid',clock_timestamp()),
 (successor,successor||'@boss-transfer.invalid',clock_timestamp()),
 (stranger,stranger||'@boss-transfer.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Voluntary Boss Handoff TEST','essential');
 other_c:=public.create_company_for_edition('Other Boss Handoff TEST','essential');
 insert into public.company_members(company_id,user_id,role)
 values(c,successor,'admin'),(other_c,stranger,'admin');
 insert into auth.sessions(id,user_id,aal,not_after)
 values(bsess,boss,'aal2',clock_timestamp()+interval '20 minutes'),
 (ssess,successor,'aal2',clock_timestamp()+interval '20 minutes');
 perform set_config('request.jwt.claims',
  jsonb_build_object('sub',boss,'session_id',bsess,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 denied:=false;
 begin perform public.essential_boss_handoff_request(c,stranger,c::text||':'||stranger::text,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Foreign-company successor was permitted';end if;
 denied:=false;
 begin perform public.essential_boss_handoff_request(c,successor,'wrong',reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Wrong company-successor confirmation was permitted';end if;
 result:=public.essential_boss_handoff_request(c,successor,c::text||':'||successor::text,reason);
 req:=(result->>'id')::uuid;version:=(result->>'version')::int;
 if version<>1 then raise exception 'Unexpected first request version';end if;
 denied:=false;
 begin perform public.essential_boss_handoff_complete(c,req,1,c::text||':'||successor::text);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Unaccepted transfer was completed';end if;
 perform set_config('request.jwt.claim.sub',successor::text,true);
 perform set_config('request.jwt.claims',
 jsonb_build_object('sub',successor,'session_id',ssess,'aal','aal2')::text,true);
 result:=public.essential_boss_handoff_status(c);
 if result->>'to_user'<>successor::text or not (result->>'can_accept')::boolean
 then raise exception 'Successor cannot view legitimate request %',result;end if;
 denied:=false;
 begin perform public.essential_boss_handoff_accept(c,req,1,'wrong');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Wrong successor confirmation accepted';end if;
 denied:=false;
 begin perform public.essential_boss_handoff_complete(c,req,1,c::text||':'||successor::text);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Successor could self-complete transfer';end if;
 result:=public.essential_boss_handoff_accept(c,req,1,c::text||':'||boss::text);
 if result->>'status'<>'accepted' or (result->>'version')::int<>2
 then raise exception 'Consent not stored correctly: %',result;end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 perform set_config('request.jwt.claims',
 jsonb_build_object('sub',boss,'session_id',bsess,'aal','aal2')::text,true);
 denied:=false;
 begin perform public.essential_boss_handoff_complete(c,req,1,c::text||':'||successor::text);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Stale version accepted';end if;
 execute 'reset role';
 update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id=ssess;
 execute 'set local role authenticated';
 denied:=false;
 begin perform public.essential_boss_handoff_complete(c,req,2,c::text||':'||successor::text);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Transfer succeeded after successor MFA session expired';end if;
 execute 'reset role';
 update auth.sessions set not_after=clock_timestamp()+interval '20 minutes' where id=ssess;
 execute 'set local role authenticated';
 result:=public.essential_boss_handoff_complete(c,req,2,c::text||':'||successor::text);
 if result->>'status'<>'completed' or result->>'new_boss'<>successor::text then raise exception 'Completion failed';end if;
 execute 'reset role';
 if not exists(select 1 from public.company_members where company_id=c and user_id=successor and role='boss' and status='active')
 or not exists(select 1 from public.company_members where company_id=c and user_id=boss and role='admin' and status='active')
 then raise exception 'Roles not atomically transferred';end if;
 if (select count(*) from public.workforce_audit where company_id=c and action in
 ('boss_handoff_requested','boss_handoff_accepted','boss_handoff_completed'))<>3
 then raise exception 'Audit events missing';end if;
 if not exists(select 1 from public.company_members where company_id=other_c and user_id=boss and role='boss')
 then raise exception 'Foreign company Boss was modified';end if;
 perform set_config('request.jwt.claim.sub',successor::text,true);
 perform set_config('request.jwt.claims',
 jsonb_build_object('sub',successor,'session_id',ssess,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 result:=public.essential_boss_handoff_request(c,boss,c::text||':'||boss::text,reason);
 req:=(result->>'id')::uuid;
 result:=public.essential_boss_handoff_cancel(c,req,1);
 if result->>'status'<>'cancelled' then raise exception 'Cannot cancel a new handoff';end if;
 execute 'reset role';
 if (select count(*) from private.essential_boss_handoffs where company_id=c and status in('pending','accepted'))<>0
 then raise exception 'Open handoff after cancellation';end if;
end $t$;
rollback;
