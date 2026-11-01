-- Execute on a disposable fully migrated database. Transaction rolls back.
begin;
do $$
declare boss uuid:=gen_random_uuid();recipient uuid:=gen_random_uuid();c uuid;d uuid;
 plus_chat uuid;construction_chat uuid;first_msg uuid;second_msg uuid;r jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@test.invalid',now()),(recipient,recipient||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Unread fixture','essential');
 d:=public.create_my_company('Construction unread fixture');
 update public.companies set billing_status='active' where id in(c,d);
 update public.companies set is_test=true,billing_mode='test_simulated' where id=c;
 insert into private.essential_test_plans(company_id,snapshot)
 select c,to_jsonb(p) from public.essential_plans p where id='essential_plus';
 insert into public.company_members(company_id,user_id,role)
 values(c,recipient,'employee'),(d,recipient,'employee');
 execute 'set local role authenticated';
 plus_chat:=public.create_company_group(c,'Plus fixture',array[recipient]);
 construction_chat:=public.create_company_group(d,'Construction fixture',array[recipient]);
 insert into public.conversation_messages(company_id,conversation_id,sender_id,body)
 values(c,plus_chat,boss,'Message 1') returning id into first_msg;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 r:=public.chat_unread_counts(c);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=plus_chat::text and (e->>'unread')::integer=1)
 then raise exception 'Recipient unread missing';end if;
 perform public.chat_mark_read(c,plus_chat,first_msg);
 r:=public.chat_unread_counts(c);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=plus_chat::text and (e->>'unread')::integer=0)
 then raise exception 'Read cursor failed';end if;
 denied:=false;
 begin perform public.chat_mark_read(c,plus_chat,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Nonexistent message accepted';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 insert into public.conversation_messages(company_id,conversation_id,sender_id,body)
 values(c,plus_chat,boss,'Message 2') returning id into second_msg;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 perform public.chat_mark_read(c,plus_chat,first_msg);
 r:=public.chat_unread_counts(c);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=plus_chat::text and (e->>'unread')::integer=1)
 then raise exception 'Stale cursor advanced';end if;
 perform public.chat_mark_read(c,plus_chat,second_msg);
 r:=public.chat_unread_counts(c);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=plus_chat::text and (e->>'unread')::integer=0)
 then raise exception 'New cursor did not advance';end if;
 -- Real database grants do not permit clients to forge their own cursors.
 denied:=false;
 begin insert into public.chat_read_cursors(company_id,conversation_id,user_id,last_read_at,last_read_message_id)
 values(c,plus_chat,recipient,clock_timestamp(),gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct cursor write bypass';end if;
 execute 'reset role';
 update private.essential_test_plans set snapshot=(select to_jsonb(p) from public.essential_plans p where id='essential')
 where company_id=c;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 execute 'set local role authenticated';
 if public.chat_unread_counts(c)<>'[]'::jsonb then raise exception 'Basic plan leaked unread messages';end if;
 denied:=false;
 begin perform public.chat_mark_read(c,plus_chat,second_msg);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Basic plan marked Plus conversation read';end if;
 -- Construction retains original chat eligibility, but not foreign messages.
 r:=public.chat_unread_counts(d);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=construction_chat::text)
 then raise exception 'Construction unread endpoint blocked';end if;
 denied:=false;
 begin perform public.chat_mark_read(d,plus_chat,second_msg);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-company message cursor allowed';end if;
 -- Restore Pro and confirm server-preserved status remains available.
 execute 'reset role';
 update private.essential_test_plans set snapshot=(select to_jsonb(p) from public.essential_plans p where id='essential_pro')
 where company_id=c;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 execute 'set local role authenticated';
 r:=public.chat_unread_counts(c);
 if not exists(select 1 from jsonb_array_elements(r) e where e->>'conversation_id'=plus_chat::text and (e->>'unread')::integer=0)
 then raise exception 'Pro did not restore previous read cursor';end if;
end $$;
rollback;
