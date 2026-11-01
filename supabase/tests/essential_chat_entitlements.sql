-- Run against a disposable migrated test database. No Stripe account.
-- Transaction is intentionally rolled back, even after successful assertions.
begin;
do $$
declare boss uuid:=gen_random_uuid();lead_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();
 essential_company uuid;construction_company uuid;group_id uuid;private_id uuid;team_id uuid;construction_group uuid;
 denied boolean;found_count integer;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@test.invalid',now()),(lead_id,lead_id||'@test.invalid',now()),
       (other_id,other_id||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 essential_company:=public.create_company_for_edition('Chat entitlement test','essential');
 construction_company:=public.create_my_company('Construction chat control');
 update public.companies set billing_status='active' where id in (essential_company,construction_company);
 update public.companies set is_test=true,billing_mode='test_simulated' where id=essential_company;
 insert into private.essential_test_plans(company_id,snapshot)
 select essential_company,to_jsonb(p) from public.essential_plans p where p.id='essential_plus';
 insert into public.company_members(company_id,user_id,role)
 values(essential_company,lead_id,'lead'),(construction_company,other_id,'employee');
 execute 'set local role authenticated';
 -- Plus grants normal group, message and private team access to participants.
 group_id:=public.create_company_group(essential_company,'Fixture Groupe',array[lead_id]);
 insert into public.conversation_messages(company_id,conversation_id,sender_id,body)
 values(essential_company,group_id,boss,'Fixture Plus message');
 if (select count(*) from public.conversation_messages where conversation_id=group_id)<>1
 then raise exception 'Plus message read failed';end if;
 team_id:=public.create_team(essential_company,'Fixture Team',lead_id);
 perform set_config('request.jwt.claim.sub',lead_id::text,true);
 private_id:=public.create_private_team_chat(team_id);
 if private_id is null or (select count(*) from public.conversations where id=private_id)<>1
 then raise exception 'Plus private team chat failed';end if;
 -- Downgrade through an isolated test snapshot; legacy rows stay intact.
 execute 'reset role';
 update private.essential_test_plans set snapshot=(select to_jsonb(p) from public.essential_plans p where p.id='essential')
 where company_id=essential_company;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.conversations where id=group_id) or
    exists(select 1 from public.conversation_messages where conversation_id=group_id) or
    exists(select 1 from public.conversation_members where conversation_id=group_id)
 then raise exception 'Basic must not read Plus conversations';end if;
 denied:=false;
 begin
  insert into public.conversation_messages(company_id,conversation_id,sender_id,body)
  values(essential_company,group_id,boss,'Blocked Basic message');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Basic direct message insert succeeded';end if;
 denied:=false;
 begin perform public.create_company_group(essential_company,'Blocked Basic group',array[]::uuid[]);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Basic group creation succeeded';end if;
 denied:=false;
 begin perform public.add_group_member(group_id,lead_id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Basic group membership edit succeeded';end if;
 perform set_config('request.jwt.claim.sub',lead_id::text,true);
 denied:=false;
 begin perform public.create_private_team_chat(team_id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Basic private team chat succeeded';end if;
 -- Pro restores the same saved conversation without duplicating messages.
 execute 'reset role';
 update private.essential_test_plans set snapshot=(select to_jsonb(p) from public.essential_plans p where p.id='essential_pro')
 where company_id=essential_company;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.conversation_messages where conversation_id=group_id)<>1
 then raise exception 'Pro upgrade did not recover saved Plus message';end if;
 -- Construction keeps its original chat path.
 construction_group:=public.create_company_group(construction_company,'Fixture Construction',array[other_id]);
 if construction_group is null then raise exception 'Construction group blocked';end if;
 insert into public.conversation_messages(company_id,conversation_id,sender_id,body)
 values(construction_company,construction_group,boss,'Fixture Construction message');
 if (select count(*) from public.conversation_messages where conversation_id=construction_group)<>1
 then raise exception 'Construction message blocked';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if (select count(*) from public.conversations where id=construction_group)<>1 or
    exists(select 1 from public.conversations where id=group_id)
 then raise exception 'Cross-company conversation visibility incorrect';end if;
end $$;
rollback;
