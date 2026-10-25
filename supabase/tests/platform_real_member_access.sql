begin;
-- Apply migration to a disposable database or wrap its text in same transaction.
-- Synthetic company/users only. Execute together with the matching migration inside BEGIN/ROLLBACK.
do $test$
declare boss_id uuid:=gen_random_uuid();employee_id uuid:=gen_random_uuid();
 owner_id uuid;sid uuid:=gen_random_uuid();c uuid;other_company uuid;
 worker_id uuid;worker_before public.company_workers;v jsonb;denied boolean;reason text:='Validation synthétique MFA multi-entreprise';
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss_id,boss_id||'@real-member-test.invalid',clock_timestamp()),
       (employee_id,employee_id||'@real-member-test.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss_id::text,true);
 c:=public.create_company_for_edition('Access scoped test company','essential');
 other_company:=public.create_company_for_edition('Independent test company','essential');
 update public.companies set is_test=false,billing_status='active' where id in(c,other_company);
 insert into public.company_members(company_id,user_id,role) values(c,employee_id,'employee'),(other_company,employee_id,'employee');
 if not exists(select 1 from public.company_workers where company_id=c and auth_user_id=employee_id) then
  insert into public.company_workers(company_id,auth_user_id,employee_number,first_name,last_name,can_mobile_punch,can_kiosk_punch,personal_access)
   values(c,employee_id,'TEST-SCOPED','Test','Employee',true,true,true);
 end if;
 select * into worker_before from public.company_workers where company_id=c and auth_user_id=employee_id;
 if worker_before.id is null then raise exception 'Fixture worker missing';end if;
 select user_id into owner_id from private.platform_owner limit 1;
 insert into auth.sessions(id,user_id,aal,not_after)
 values(sid,owner_id,'aal2',clock_timestamp()+interval '15 minutes');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 v:=public.platform_member_access_preview(c,employee_id,reason);
 if (v->>'version')::integer<>0 or not (v->>'can_suspend')::boolean
 then raise exception 'Initial preview wrong: %',v;end if;
 denied:=false;
 begin
  perform public.platform_member_access_change(c,employee_id,'suspend',0,'wrong-confirmation',reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Wrong confirmation accepted';end if;
 v:=public.platform_member_access_change(c,employee_id,'suspend',0,employee_id::text||':'||c::text,reason);
 if v->>'member_status'<>'disabled' or (v->>'version')::integer<>1 then raise exception 'Suspension failed: %',v;end if;
 execute 'reset role';
 if exists(select 1 from public.company_members where company_id=c and user_id=employee_id and status<>'disabled')
  or exists(select 1 from public.company_workers where id=worker_before.id and (can_mobile_punch or can_kiosk_punch or personal_access))
 then raise exception 'Suspension did not block company access';end if;
 if not exists(select 1 from public.company_members where company_id=other_company and user_id=employee_id and status='active')
 then raise exception 'Other company membership was changed';end if;
 execute 'set local role authenticated';
 v:=public.platform_member_access_preview(c,employee_id,reason);
 if not (v->>'can_restore')::boolean then raise exception 'Restore preview blocked: %',v;end if;
 denied:=false;begin
  perform public.platform_member_access_change(c,employee_id,'restore',0,employee_id::text||':'||c::text,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Stale version accepted';end if;
 v:=public.platform_member_access_change(c,employee_id,'restore',1,employee_id::text||':'||c::text,reason);
 if v->>'member_status'<>'active' or (v->>'version')::integer<>2 then raise exception 'Restore failed: %',v;end if;
 execute 'reset role';
 if not exists(select 1 from public.company_members where company_id=c and user_id=employee_id and status='active')
 then raise exception 'Membership was not restored';end if;
 if exists(select 1 from public.company_workers where id=worker_before.id and (
 can_mobile_punch is distinct from worker_before.can_mobile_punch or
 can_kiosk_punch is distinct from worker_before.can_kiosk_punch or
 personal_access is distinct from worker_before.personal_access))
 then raise exception 'Original worker flags changed';end if;
 if (select count(*) from private.platform_audit where entity_id=employee_id and action like 'real_member_access_%')<4
 then raise exception 'Expected audit events absent';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',employee_id::text,true);
 denied:=false;
 begin perform public.platform_member_access_preview(c,employee_id,reason);
 exception when others then denied:=true;end;
 if not denied then raise exception 'Regular employee opened Super Admin preview';end if;
 execute 'reset role';
end $test$;
rollback;
