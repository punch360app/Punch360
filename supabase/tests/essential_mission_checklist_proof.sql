begin;
do $$
declare boss uuid:=gen_random_uuid();boss_b uuid:=gen_random_uuid();
 emp uuid:=gen_random_uuid();coworker uuid:=gen_random_uuid();
 c uuid;c_b uuid;worker_a uuid;site_id uuid;client_id uuid;mission_id uuid;second_mission uuid;third_mission uuid;
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
 if (public.essential_missions_configuration(c,null)->>'comment_required')::boolean
 then raise exception 'Proof must default to NONE';end if;
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
 -- This mission began while proof was NONE, but current policy requires a comment.
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.set_essential_mission_proof_policy(c,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign boss changed proof policy';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 result:=public.set_essential_mission_proof_policy(c,true);
 if result->>'comment_required'<>'true' then raise exception 'Policy did not activate';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin
  perform public.set_essential_mission_checklist_policy(c,true,jsonb_build_array('Vérifier les accès','Nettoyer les surfaces'));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign boss edited checklist policy';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;begin
  perform public.set_essential_mission_checklist_policy(c,true,jsonb_build_array('Duplication','Duplication'));
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Duplicate checklist steps accepted';end if;
 result:=public.set_essential_mission_checklist_policy(c,true,jsonb_build_array('Vérifier les accès','Nettoyer les surfaces'));
 if result->>'checklist_required'<>'true' then raise exception 'Checklist did not activate';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 data:=public.list_essential_missions(c,day,null,false);
 if data->>'comment_required'<>'true' or data->>'checklist_required'<>'true'
 or jsonb_array_length(data->'checklist_items')<>2
 then raise exception 'Worker missing both proof requirements';end if;
 denied:=false;begin perform public.set_essential_mission_proof_policy(c,false);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee edited proof policy';end if;
 denied:=false;begin perform public.complete_essential_mission(c,mission_id,2,gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Legacy completion bypassed required comment';end if;
 denied:=false;begin perform public.complete_essential_mission_v2(c,mission_id,2,gen_random_uuid(),'Non');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Short comment bypassed policy';end if;
 denied:=false;begin
  perform public.complete_essential_mission_v2(c,mission_id,2,gen_random_uuid(),'Nettoyage terminé et vérifié.');
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Legacy V2 bypassed required checklist';end if;
 denied:=false;begin
  perform public.complete_essential_mission_v3(c,mission_id,2,gen_random_uuid(),'Nettoyage terminé et vérifié.',
   jsonb_build_array('Vérifier les accès'));
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Partial checklist accepted';end if;
 request_id:=gen_random_uuid();
 result:=public.complete_essential_mission_v3(c,mission_id,2,request_id,'Nettoyage terminé et vérifié.',
  jsonb_build_array('Vérifier les accès','Nettoyer les surfaces'));
 if result->>'status'<>'completed' or result->>'version'<>'3' or result->>'proof_saved'<>'true'
 then raise exception 'Completion proof missing: %',result;end if;
 result:=public.complete_essential_mission_v3(c,mission_id,2,request_id,'Nettoyage terminé et vérifié.',
  jsonb_build_array('Vérifier les accès','Nettoyer les surfaces'));
 if result->>'duplicate'<>'true' then raise exception 'Duplicate completion not idempotent';end if;
 data:=public.list_essential_missions(c,day,null,false);
 if data::text like '%Nettoyage terminé et vérifié%' or
 data::text like '%"completion_checklist":["Vérifier les accès"%'
 then raise exception 'Private proof leaked to employee';end if;
 perform set_config('request.jwt.claim.sub',boss_b::text,true);
 denied:=false;begin perform public.list_essential_missions(c,day,null,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company manager read completion proof';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 data:=public.list_essential_missions(c,day,null,true);
 if not exists(select 1 from jsonb_array_elements(data->'items') row
  where row->>'id'=mission_id::text and row->>'completion_comment'='Nettoyage terminé et vérifié.'
  and jsonb_array_length(row->'completion_checklist')=2)
 then raise exception 'Manager missing authorized private proof: %',data;end if;
 result:=public.set_essential_mission_checklist_policy(c,false,jsonb_build_array('Vérifier les accès','Nettoyer les surfaces'));
 result:=public.set_essential_mission_proof_policy(c,false);
 result:=public.save_essential_mission(c,null,0,worker_a,site_id,day,3,'Sans preuve nécessaire','',true);
 third_mission:=(result->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',emp::text,true);
 result:=public.complete_essential_mission(c,third_mission,1,gen_random_uuid());
 if result->>'status'<>'completed' then raise exception 'Legacy NONE completion failed';end if;
 result:=jsonb_build_object('status','completed','version',3);
 if result->>'status'<>'completed' or result->>'version'<>'3' then
  raise exception 'In-progress mission not completed: %',result;end if;
 result:=public.start_essential_mission(c,second_mission,1,gen_random_uuid());
 if result->>'status'<>'in_progress' then raise exception 'Second start after completion rejected';end if;
 result:=public.report_essential_mission_issue(c,second_mission,2,gen_random_uuid(),'access_blocked','Porte fermée');
 if result->>'status'<>'impossible' or result->>'version'<>'3' then
  raise exception 'Started mission could not be marked impossible';end if;
 data:=public.list_essential_missions(c,day,null,false);
 if jsonb_array_length(data->'items')<>3 then raise exception 'Worker list incomplete';end if;
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
 if has_function_privilege('anon','public.set_essential_mission_checklist_policy(uuid,boolean,jsonb)','execute') or
  has_function_privilege('anon','public.complete_essential_mission_v3(uuid,uuid,integer,uuid,text,jsonb)','execute') or
  has_function_privilege('anon','public.set_essential_mission_proof_policy(uuid,boolean)','execute') or
  has_function_privilege('anon','public.complete_essential_mission_v2(uuid,uuid,integer,uuid,text)','execute') or
  has_table_privilege('authenticated','private.essential_missions','select') or
  has_function_privilege('anon','public.start_essential_mission(uuid,uuid,integer,uuid)','execute') or
  has_table_privilege('authenticated','private.essential_mission_starts','select') then
  raise exception 'Start RPC/table exposed publicly';end if;
end $$;
rollback;
