begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();coworker uuid:=gen_random_uuid();
 company uuid;company_b uuid;location_id uuid;worker_id uuid;shift_id uuid;late_shift uuid;
 result jsonb;alert_id uuid;notes jsonb;client_request uuid:=gen_random_uuid();denied boolean;
 jobs_before integer;sessions_before integer;original_shift public.scheduled_shifts;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (boss,boss||'@visit-alert.invalid',now()),(other_boss,other_boss||'@visit-alert.invalid',now()),
 (employee,employee||'@visit-alert.invalid',now()),(coworker,coworker||'@visit-alert.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Visite alert test A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 company_b:=public.create_company_for_edition('Visite alert test B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active'
 where id in (company,company_b);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,employee,'employee','active'),(company,coworker,'employee','active');
 select id into worker_id from public.company_workers where company_id=company and auth_user_id=employee;
 select id into location_id from public.essential_locations where company_id=company and active limit 1;
 select count(*) into sessions_before from public.punch_sessions where company_id=company;
 select count(*) into jobs_before from public.jobs where company_id=company;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 shift_id:=public.save_essential_local_shift(company,worker_id,location_id,null,
  (current_date+1)::timestamp+time '08:00',(current_date+1)::timestamp+time '12:00','Client matin');
 late_shift:=public.save_essential_local_shift(company,worker_id,location_id,null,
  (current_date+10)::timestamp+time '08:00',(current_date+10)::timestamp+time '12:00','Client tardif');
 execute 'reset role';
 select * into original_shift from public.scheduled_shifts where id=shift_id;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',employee::text,true);
 result:=public.submit_essential_visit_alert(shift_id,'access_issue','Entrée arrière bloquée — pas de GPS',client_request);
 if result->>'status'<>'reported' or result->>'delivered'<>'1' or result->>'replayed'<>'false' then
  raise exception 'First alert failed: %',result;end if;
 alert_id:=(result->>'id')::uuid;
 result:=public.submit_essential_visit_alert(shift_id,'access_issue','Entrée arrière bloquée — pas de GPS',client_request);
 if result->>'replayed'<>'true' or result->>'id'<>alert_id::text then
  raise exception 'Idempotence failed: %',result;end if;
 denied:=false;begin
   perform public.submit_essential_visit_alert(shift_id,'possible_delay','Autre sujet',client_request);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Request ID reused with different kind';end if;
 result:=public.list_essential_visit_alerts(company,now()-interval '1 day',now()+interval '1 day');
 if jsonb_array_length(result->'items')<>1 or result->'items'->0->>'note'<>'Entrée arrière bloquée — pas de GPS'
 then raise exception 'Own alert not visible: %',result;end if;
 denied:=false;begin perform public.submit_essential_visit_alert(late_shift,'possible_delay','',gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Alert far from shift time was allowed';end if;
 result:=public.submit_essential_visit_alert(shift_id,'possible_delay','Je crois être en retard',gen_random_uuid());
 if result->>'delivered'<>'1' then raise exception 'Second alert missing';end if;
 denied:=false;begin perform public.submit_essential_visit_alert(shift_id,'access_issue','3e fois',gen_random_uuid());
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Flood control missing';end if;
 perform set_config('request.jwt.claim.sub',coworker::text,true);
 denied:=false;begin perform public.submit_essential_visit_alert(shift_id,'access_issue','Autre employé',gen_random_uuid());
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Coworker could report worker shift';end if;
 notes:=public.list_essential_visit_alerts(company,now()-interval '1 day',now()+interval '1 day');
 if jsonb_array_length(notes->'items')<>0 then raise exception 'Coworker saw private notes';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;begin perform public.list_essential_visit_alerts(company,now()-interval '1 day',now()+interval '1 day');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company saw report list';end if;
 denied:=false;begin perform public.acknowledge_essential_visit_alert(alert_id);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other company acknowledged';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 notes:=public.list_essential_visit_alerts(company,now()-interval '1 day',now()+interval '1 day');
 if jsonb_array_length(notes->'items')<>2 then raise exception 'Boss did not see reports: %',notes;end if;
 result:=public.acknowledge_essential_visit_alert(alert_id);
 if result->>'status'<>'acknowledged' or result->>'unchanged'<>'false' then raise exception 'Ack failed';end if;
 result:=public.acknowledge_essential_visit_alert(alert_id);
 if result->>'unchanged'<>'true' then raise exception 'Repeated ack not idempotent';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 notes:=public.list_essential_visit_alerts(company,now()-interval '1 day',now()+interval '1 day');
 if not exists(select 1 from jsonb_array_elements(notes->'items') v
    where v->>'id'=alert_id::text and v->>'status'='acknowledged')
 then raise exception 'Employee cannot see acknowledged status';end if;
 execute 'reset role';
 if (select count(*) from public.app_notifications where company_id=company
   and recipient_id=boss and kind='shift_visit_alert')<>2 then
  raise exception 'Manager duplicate or missing notifications';end if;
 if (select count(*) from public.app_notifications where company_id=company
   and recipient_id=employee and kind='shift_visit_alert_acknowledged')<>1 then
  raise exception 'Employee ack notification absent or repeated';end if;
 if exists(select 1 from public.app_notifications where company_id=company
  and (body ilike '%arrière bloquée%' or body ilike '%GPS%')) then
  raise exception 'Private note leaked into notification';end if;
 if (select count(*) from private.essential_visit_alerts where company_id=company)<>2 then
  raise exception 'Unexpected report rows';end if;
 if has_table_privilege('authenticated','private.essential_visit_alerts','select') or
    has_function_privilege('anon','public.submit_essential_visit_alert(uuid,text,text,uuid)','execute')
 then raise exception 'Private alert data not sufficiently restricted';end if;
 if (select count(*) from public.punch_sessions where company_id=company)<>sessions_before or
    (select count(*) from public.jobs where company_id=company)<>jobs_before or
    (select starts_at from public.scheduled_shifts where id=shift_id)<>original_shift.starts_at then
  raise exception 'Alert changed hours, Punch sessions or jobs';end if;
end $$;
rollback;
