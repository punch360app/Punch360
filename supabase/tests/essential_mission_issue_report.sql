-- MISSION-007: actual provider RPC, synthetic user/tenant isolation, retry idempotency,
-- manager notifications without private notes, zero timekeeping mutations.
begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();worker_user uuid:=gen_random_uuid();
 coworker uuid:=gen_random_uuid();company uuid;other_company uuid;w uuid;client uuid;site uuid;
 mission uuid;other_mission uuid;req uuid:=gen_random_uuid();result jsonb;before_jobs int;
 before_punch int;before_shifts int;denied boolean;tomorrow date:=current_date+4;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@mission-issue.invalid',now()),(boss_b,boss_b||'@mission-issue.invalid',now()),
 (worker_user,worker_user||'@mission-issue.invalid',now()),(coworker,coworker||'@mission-issue.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Impossible mission A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 other_company:=public.create_company_for_edition('Impossible mission B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(company,other_company);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,worker_user,'employee','active'),(company,coworker,'employee','active');
 select id into w from public.company_workers where company_id=company and auth_user_id=worker_user;
 select count(*) into before_jobs from public.jobs where company_id=company;
 select count(*) into before_punch from public.punch_sessions where company_id=company;
 select count(*) into before_shifts from public.scheduled_shifts where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(company,null,0,'Condo Mathieu','','','',true);
 client:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(company,null,0,client,'Visite Charlesbourg',
  '123 boulevard Henri-Bourassa','','Québec','QC','G1H 2A1','CA',
  'America/Toronto',null,null,'','','Code secret 1234','Notes gestionnaire',true);
 site:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(company,true);
 result:=public.save_essential_mission(company,null,0,w,site,tomorrow,1,'Inspection','',true);
 mission:=(result->>'id')::uuid;
 result:=public.save_essential_mission(company,null,0,w,site,tomorrow,2,'Nettoyage','',true);
 other_mission:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',coworker::text,true);
 denied:=false;
 begin perform public.report_essential_mission_issue(company,mission,1,req,'access_blocked','Code secret tenté');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Coworker reported another worker mission';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;
 begin perform public.report_essential_mission_issue(company,mission,1,req,'access_blocked','');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-company report allowed';end if;
 perform set_config('request.jwt.claim.sub',worker_user::text,true);
 denied:=false;
 begin perform public.report_essential_mission_issue(company,mission,1,req,'invalid_reason','');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Invalid reason accepted';end if;
 result:=public.report_essential_mission_issue(company,mission,1,req,'access_blocked','Porte verrouillée');
 if result->>'status'<>'impossible' or result->>'duplicate'<>'false' or (result->>'version')::int<>2
 then raise exception 'Issue not recorded: %',result;end if;
 result:=public.report_essential_mission_issue(company,mission,1,req,'access_blocked','Porte verrouillée');
 if result->>'duplicate'<>'true' or (result->>'version')::int<>2
 then raise exception 'Idempotent retry failed: %',result;end if;
 denied:=false;
 begin perform public.report_essential_mission_issue(company,mission,2,gen_random_uuid(),'other','');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Distinct request re-submitted already impossible mission';end if;
 result:=public.list_essential_missions(company,tomorrow,null,false);
 if jsonb_array_length(result->'items')<>2 or
  result->'items'->0->>'status'<>'impossible' or result->'items'->1->>'status'<>'published'
 then raise exception 'Employee cannot see an impossible mission next to a pending mission: %',result;end if;
 if result::text like '%Porte verrouillée%' or result::text like '%Code secret 1234%' then
  raise exception 'Private issue text leaked to employee list';end if;
 execute 'reset role';
 if (select count(*) from public.jobs where company_id=company)<>before_jobs or
  (select count(*) from public.punch_sessions where company_id=company)<>before_punch or
  (select count(*) from public.scheduled_shifts where company_id=company)<>before_shifts
 then raise exception 'Mission issue mutated punch, job or shifts';end if;
 if (select count(*) from public.app_notifications where company_id=company and recipient_id=boss
  and kind='mission_issue')<>1 then raise exception 'Boss was not notified exactly once';end if;
 if exists(select 1 from public.app_notifications where company_id=company and kind='mission_issue'
  and body ilike '%Porte verrouillée%') then raise exception 'Private note in notification';end if;
 if has_function_privilege('anon','public.report_essential_mission_issue(uuid,uuid,integer,uuid,text,text)','execute')
 then raise exception 'Anon RPC unexpectedly executable';end if;
end $$;
rollback;