begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 emp uuid:=gen_random_uuid();coworker uuid:=gen_random_uuid();
 c uuid;c_b uuid;worker_a uuid;site_id uuid;client_id uuid;mission_id uuid;
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
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.report_essential_mission_issue(c,mission_id,1,request_id,'access_blocked','La porte est fermée.');
 if result->>'status'<>'impossible' or result->>'duplicate'<>'false' or (result->>'version')::int<>2
 then raise exception 'First issue not recorded: %',result;end if;
 result:=public.report_essential_mission_issue(c,mission_id,1,request_id,'access_blocked','La porte est fermée.');
 if result->>'duplicate'<>'true' or result->>'version'<>'2' then raise exception 'Replay created new issue: %',result;end if;
 denied:=false;begin perform public.report_essential_mission_issue(c,mission_id,2,gen_random_uuid(),'other','Nouveau');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Mission issue could be submitted twice';end if;
 denied:=false;begin perform public.complete_essential_mission(c,mission_id,2,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Impossible mission completed as success';end if;
 data:=public.list_essential_missions(c,day,null,false);
 if jsonb_array_length(data->'items')<>1 or data->'items'->0->>'status'<>'impossible' or
  data->'items'->0->>'issue_reason'<>'access_blocked' then raise exception 'Employee issue list incorrect: %',data;end if;
 if data::text like '%La porte est fermée%' or data::text like '%Code confidentiel%' then
  raise exception 'Issue note or site code exposed to employee list';end if;
 perform set_config('request.jwt.claim.sub',coworker::text,true);
 data:=public.list_essential_missions(c,day,null,false);
 if jsonb_array_length(data->'items')<>0 then raise exception 'Coworker mission leaked';end if;
 denied:=false;begin perform public.report_essential_mission_issue(c,mission_id,2,gen_random_uuid(),'other','');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unassigned worker reported issue';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.report_essential_mission_issue(c,mission_id,1,gen_random_uuid(),'other','');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Manager B can report A mission';end if;
 denied:=false;begin perform public.list_essential_missions(c,day,null,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Manager B can see A mission';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 data:=public.list_essential_missions(c,day,null,true);
 if data->'items'->0->>'issue_note'<>'La porte est fermée.' then
  raise exception 'Manager cannot read authorized issue note';end if;
 execute 'reset role';
 if (select count(*) from public.app_notifications where company_id=c and recipient_id=boss and kind='mission_issue')<>1
 then raise exception 'Expected one targeted manager alert';end if;
 if exists(select 1 from public.app_notifications where company_id=c and kind='mission_issue' and body ilike '%porte%')
 then raise exception 'Private problem note leaked in notification';end if;
 if (select count(*) from public.punch_sessions where company_id=c)<>punch_before or
    (select count(*) from public.scheduled_shifts where company_id=c)<>shift_before or
    (select count(*) from public.jobs where company_id=c)<>jobs_before then
  raise exception 'Mission issue created punch, shift or job';end if;
 if has_table_privilege('authenticated','private.essential_mission_issue_requests','select') or
  has_function_privilege('anon','public.report_essential_mission_issue(uuid,uuid,integer,uuid,text,text)','execute')
 then raise exception 'Private issue data made publicly visible';end if;
end $$;
rollback;
