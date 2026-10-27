begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 emp uuid:=gen_random_uuid();coworker uuid:=gen_random_uuid();
 c uuid;c_b uuid;worker_a uuid;site_id uuid;client_id uuid;mission_id uuid;second_mission uuid;
 day date:=current_date+3;request_id uuid:=gen_random_uuid();
 result jsonb;data jsonb;denied boolean;punch_before integer;shift_before integer;jobs_before integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@mission-issue.test.invalid',now()),(boss_b,boss_b||'@mission-issue.test.invalid',now()),
 (emp,emp||'@mission-issue.test.invalid',now()),(coworker,coworker||'@mission-issue.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Mission issue A','essential');
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 c_b:=public.create_company_for_edition('Mission issue B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(c,c_b);
 insert into public.company_members(company_id,user_id,role,status)
 values(c,emp,'employee','active'),(c,coworker,'employee','active');
 select id into worker_a from public.company_workers where company_id=c and auth_user_id=emp;
 select count(*) into punch_before from public.punch_sessions where company_id=c;
 select count(*) into shift_before from public.scheduled_shifts where company_id=c;
 select count(*) into jobs_before from public.jobs where company_id=c;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.save_essential_client(c,null,0,'Clinique infirmière','','','',true);
 client_id:=(result->>'id')::uuid;
 result:=public.save_essential_client_site(c,null,0,client_id,'Visite',
  '123 rue des Sapins','','Québec','QC','G1K 1A1','CA','America/Toronto',
  null,null,'','','', 'Code confidentiel — ne jamais divulguer',true);
 site_id:=(result->>'id')::uuid;
 perform public.essential_missions_configuration(c,true);
 result:=public.save_essential_mission(c,null,0,worker_a,site_id,day,1,'Visite du client','Instructions secrètes',true);
 mission_id:=(result->>'id')::uuid;
 result:=public.save_essential_mission(c,null,0,worker_a,site_id,day,2,'Suite de la tournée','Instructions privées B',true);
 second_mission:=(result->>'id')::uuid;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.start_essential_mission(c,mission_id,1,request_id);
 if result->>'status'<>'in_progress' or result->>'version'<>'2' or result->>'duplicate'<>'false'
 then raise exception 'First explicit start failed: %',result;end if;
 result:=public.start_essential_mission(c,mission_id,1,request_id);
 if result->>'duplicate'<>'true' then raise exception 'Idempotent start duplicate not detected';end if;
 denied:=false;begin perform public.start_essential_mission(c,second_mission,1,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Second concurrent mission started for same worker';end if;
 denied:=false;begin perform public.start_essential_mission(c,mission_id,2,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Double start of same mission accepted';end if;
 data:=public.get_essential_published_mission_details(c,mission_id,2);
 if data->>'instructions'<>'Instructions secrètes' then
  raise exception 'Started worker lost private instructions';end if;
 perform set_config('request.jwt.claim.sub',coworker::text,true);
 denied:=false;begin perform public.start_essential_mission(c,second_mission,1,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unassigned worker started mission';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.start_essential_mission(c,second_mission,1,gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign company manager started mission';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.complete_essential_mission(c,mission_id,2,gen_random_uuid());
 if result->>'status'<>'completed' or result->>'version'<>'3' then
  raise exception 'In-progress mission not completed: %',result;end if;
 result:=public.start_essential_mission(c,second_mission,1,gen_random_uuid());
 if result->>'status'<>'in_progress' then raise exception 'Second start after completion rejected';end if;
 result:=public.report_essential_mission_issue(c,second_mission,2,gen_random_uuid(),'access_blocked','Porte fermée');
 if result->>'status'<>'impossible' or result->>'version'<>'3' then
  raise exception 'Started mission could not be marked impossible';end if;
 data:=public.list_essential_missions(c,day,null,false);
 if jsonb_array_length(data->'items')<>2 then raise exception 'Worker list incomplete';end if;
 if data::text like '%Porte fermée%' or data::text like '%Code confidentiel%' then
  raise exception 'Private mission note or code leaked';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 data:=public.list_essential_missions(c,day,null,true);
 if data->'items'->1->>'status'<>'impossible' or data->'items'->1->>'issue_note'<>'Porte fermée' then
  raise exception 'Manager issue state incomplete: %',data;end if;
 execute 'reset role';
 if (select count(*) from public.punch_sessions where company_id=c)<>punch_before or
 (select count(*) from public.scheduled_shifts where company_id=c)<>shift_before or
 (select count(*) from public.jobs where company_id=c)<>jobs_before then
  raise exception 'Voluntary start changed times, shifts or jobs';end if;
 if has_function_privilege('anon','public.start_essential_mission(uuid,uuid,integer,uuid)','execute') or
  has_table_privilege('authenticated','private.essential_mission_starts','select') then
  raise exception 'Start RPC/table exposed publicly';end if;
end $$;
rollback;
