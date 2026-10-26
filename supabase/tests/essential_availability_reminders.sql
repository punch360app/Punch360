begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();
 emp_missing uuid:=gen_random_uuid();emp_done uuid:=gen_random_uuid();
 company uuid;other_company uuid;location_id uuid;dept uuid;
 worker_missing uuid;worker_done uuid;worker_offline uuid;week_monday date;
 result jsonb;denied boolean;note_id uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss,boss||'@reminder.test.invalid',now()),(other_boss,other_boss||'@reminder.test.invalid',now()),
  (emp_missing,emp_missing||'@reminder.test.invalid',now()),
  (emp_done,emp_done||'@reminder.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Availability reminders A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 other_company:=public.create_company_for_edition('Availability reminders B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=25
 where id in(company,other_company);
 insert into private.essential_test_plans(company_id,snapshot)
 select c.company_id,to_jsonb(p) from (values(company),(other_company)) c(company_id)
 cross join public.essential_plans p where p.id='essential_plus';
 insert into public.company_members(company_id,user_id,role,status)
 values(company,emp_missing,'employee','active'),(company,emp_done,'employee','active');
 perform set_config('request.jwt.claim.sub',boss::text,true);
 select id into location_id from public.essential_locations where company_id=company and active limit 1;
 dept:=public.save_essential_department(company,location_id,'Preparation');
 select id into worker_missing from public.company_workers where company_id=company and auth_user_id=emp_missing;
 select id into worker_done from public.company_workers where company_id=company and auth_user_id=emp_done;
 perform public.assign_essential_worker(worker_missing,location_id,dept);
 perform public.assign_essential_worker(worker_done,location_id,dept);
 insert into public.company_workers(company_id,employee_number,first_name,last_name,status,personal_access,department_id,location_id)
 values(company,'NO-APP','Sans','Application','active',false,dept,location_id) returning id into worker_offline;
 week_monday:=current_date+((8-extract(isodow from current_date)::integer)%7);
 execute 'set local role authenticated';
 perform public.save_essential_weekly_availability(company,worker_done,location_id,ARRAY[1,2,3,4,5],
 '08:00','16:00',week_monday,null,true,gen_random_uuid());
 result:=public.essential_availability_reminder_batch(company,week_monday,week_monday,dept,false);
 if (result->>'total')::int<>3 or (result->>'pending')::int<>1 or
    (result->>'with_declaration')::int<>1 or (result->>'without_account')::int<>1
 then raise exception 'Preview counts inconsistent: %',result;end if;
 execute 'reset role';
 if exists(select 1 from private.essential_availability_reminder_deliveries where company_id=company) then
  raise exception 'Preview wrote reminder delivery';end if;
 execute 'set local role authenticated';
 result:=public.essential_availability_reminder_batch(company,week_monday,week_monday,dept,true);
 if result->>'sent'<>'1' or result->>'channel'<>'internal' or result->>'no_sms'<>'true' then
  raise exception 'Internal reminder not sent: %',result;end if;
 execute 'reset role';
 select id into note_id from public.app_notifications
 where company_id=company and recipient_id=emp_missing and kind='availability_reminder';
 if note_id is null then raise exception 'Employee did not receive app notification';end if;
 if not exists(select 1 from private.essential_availability_reminder_deliveries
    where company_id=company and worker_id=worker_missing and week_start=week_monday and notification_id=note_id) then
  raise exception 'Reminder ledger missing idempotence record';end if;
 execute 'set local role authenticated';
 result:=public.essential_availability_reminder_batch(company,week_monday,week_monday,dept,true);
 execute 'reset role';
 if result->>'sent'<>'0' or result->>'already_sent'<>'1' or
   (select count(*) from public.app_notifications
    where company_id=company and recipient_id=emp_missing and kind='availability_reminder')<>1 then
  raise exception 'Duplicate reminder sent: %',result;end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',emp_missing::text,true);
 if (select count(*) from public.app_notifications where company_id=company and id=note_id)<>1 then
  raise exception 'Own notification invisible';end if;
 denied:=false;
 begin perform public.essential_availability_reminder_batch(company,week_monday,week_monday,dept,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee could issue manager reminders';end if;
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 denied:=false;
 begin perform public.essential_availability_reminder_batch(company,week_monday,week_monday,dept,true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Foreign-company reminder access permitted';end if;
 if exists(select 1 from public.app_notifications where company_id=company and id=note_id) then
  raise exception 'Foreign company can read recipient notification';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.essential_availability_reminder_batch(uuid,date,date,uuid,boolean)','execute')
 then raise exception 'Anonymous reminder RPC should be denied';end if;
 if has_table_privilege('authenticated','private.essential_availability_reminder_deliveries','select')
 then raise exception 'Private deduplication ledger exposed';end if;
 if exists(select 1 from public.scheduled_shifts where company_id=company) then
  raise exception 'Reminder inadvertently created shifts';end if;
end $$;
rollback;
