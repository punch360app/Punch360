begin;
do $$
declare boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();c uuid;l uuid;d uuid;other_d uuid;t uuid;config jsonb:='{"mode":"weekly","days":[1,3],"startTime":"23:00","endTime":"07:00","note":"Fixture night"}';denied boolean;ids uuid[];request uuid:=gen_random_uuid();w uuid;before_n bigint;n bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@template.test.invalid',now()),(employee,employee||'@template.test.invalid',now());perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Schedule template fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(p) from public.essential_plans p where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,employee,'employee');select id into l from public.essential_locations where company_id=c;
 d:=public.save_essential_department(c,l,'Planning');other_d:=public.save_essential_department(c,l,'Private team');select id into w from public.company_workers where company_id=c and auth_user_id=employee;perform public.assign_essential_worker(w,l,d);
 select count(*) into before_n from public.scheduled_shifts where company_id=c;
 t:=public.save_essential_schedule_template(c,l,d,'Night preset',config);
 if (select count(*) from public.scheduled_shifts where company_id=c)<>before_n then raise exception 'Saving template published shifts';end if;
 denied:=false;begin perform public.save_essential_schedule_template(c,l,d,'Invalid',config||'{"worker":"private-id"}');exception when others then denied:=true;end;if not denied then raise exception 'Identity persisted in template';end if;
 denied:=false;begin perform public.save_essential_schedule_template(c,l,d,'Duplicate days',config||'{"days":[1,1]}');exception when others then denied:=true;end;if not denied then raise exception 'Duplicate days allowed';end if;
 perform public.save_essential_schedule_template(c,l,d,'Night version two',config,t,1);
 denied:=false;begin perform public.save_essential_schedule_template(c,l,d,'Stale update',config,t,1);exception when others then denied:=true;end;if not denied then raise exception 'Stale update allowed';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);execute 'set local role authenticated';select count(*) into n from public.essential_schedule_templates where id=t;if n<>0 then raise exception 'Employee read model without planning scope';end if;execute 'reset role';
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_essential_supervisor(c,d,employee,true);
 perform set_config('request.jwt.claim.sub',employee::text,true);execute 'set local role authenticated';select count(*) into n from public.essential_schedule_templates where id=t;if n<>1 then raise exception 'Scoped planner cannot read model';end if;
 denied:=false;begin perform public.save_essential_schedule_template(c,l,other_d,'Outside team',config);exception when others then denied:=true;end;if not denied then raise exception 'Department bypass';end if;
 ids:=public.repeat_essential_shifts(c,w,l,d,'2027-01-04',1,array[1,3],'23:00','07:00',request,'From preset');if cardinality(ids)<>2 then raise exception 'Cycle not published';end if;
 if ids is distinct from public.repeat_essential_shifts(c,w,l,d,'2027-01-04',1,array[1,3],'23:00','07:00',request,'From preset') then raise exception 'Retry changed published IDs';end if;
 perform public.archive_essential_schedule_template(t,2);execute 'reset role';
 if (select count(*) from public.scheduled_shifts where company_id=c)<>before_n+2 then raise exception 'Archiving changed published shifts';end if;
 if exists(select 1 from public.scheduled_shifts where id=any(ids) and ends_at-starts_at<>interval '8 hours') then raise exception 'Night duration changed';end if;
end $$;
rollback;
