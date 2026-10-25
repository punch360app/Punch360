begin;
do $$
declare owner_id uuid;sid uuid:=gen_random_uuid();c uuid;ct uuid;prefix text:=replace(gen_random_uuid()::text,'-','');r jsonb;denied boolean;
begin
 select user_id into owner_id from private.platform_owner;
 insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '10 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'aal','aal2','session_id',sid)::text,true);
 c:=public.create_company_for_edition('Finance regression','essential');ct:=public.platform_create_test_company('Finance sandbox','essential',10);
 insert into private.essential_stripe_invoices(id,company_id,status,total_cents,paid_cents,currency,paid_at,period_end) values
 (prefix||'before',c,'paid',500,500,'cad','2026-10-25T03:59:59Z',null),
 (prefix||'paid',c,'paid',1000,1000,'cad','2026-10-25T04:00:00Z',null),
 (prefix||'open',c,'open',1500,0,'cad',null,'2026-10-25T09:00:00Z'),
 (prefix||'void',c,'void',900,0,'cad',null,'2026-10-25T10:00:00Z'),
 (prefix||'after',c,'paid',700,700,'cad','2026-10-26T04:00:00Z',null),
 (prefix||'test',ct,'paid',99900,99900,'cad','2026-10-25T10:00:00Z',null);
 execute 'set local role authenticated';
 r:=public.platform_finance_report('2026-10-25','2026-10-25',c);
 if (r->'totals'->>'invoices')::integer<>3 or (r->'totals'->>'total_cents')::integer<>2500 or (r->'totals'->>'paid_cents')::integer<>1000 then raise exception 'Incorrect totals or timezone range: %',r;end if;
 if (r->'totals'->>'open_count')::integer<>1 or (r->'totals'->>'void_count')::integer<>1 then raise exception 'Incorrect invoice statuses';end if;
 r:=public.platform_finance_report('2026-10-25','2026-10-25',ct);if (r->'totals'->>'invoices')::integer<>0 then raise exception 'Test company contaminated real finance';end if;
 r:=public.platform_finance_report('2026-10-25','2026-10-25',ct,true);if (r->'totals'->>'paid_cents')::integer<>99900 then raise exception 'Missing sandbox report';end if;
 denied:=false;begin perform public.platform_finance_report('2026-10-26','2026-10-25');exception when others then denied:=true;end;if not denied then raise exception 'Reverse range accepted';end if;
 execute 'reset role';delete from auth.sessions where auth.sessions.id=sid;execute 'set local role authenticated';
 denied:=false;begin perform public.platform_finance_report('2026-10-25','2026-10-25');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked MFA financial access';end if;execute 'reset role';
end $$;
rollback;
