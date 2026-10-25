begin;
do $$
declare sid uuid:=gen_random_uuid();boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();admin_user uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();owner_id uuid;c uuid;worker uuid;d public.essential_hr_documents;v public.essential_hr_documents;denied boolean;cert uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(emp,emp||'@test.invalid',now()),(admin_user,admin_user||'@test.invalid',now()),(outsider,outsider||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('HR fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into public.company_members(company_id,user_id,role) values(c,emp,'employee'),(c,admin_user,'admin');select id into worker from public.company_workers where company_id=c and auth_user_id=emp;
 select user_id into owner_id from private.platform_owner;insert into auth.sessions(id,user_id,aal,not_after) values(sid,owner_id,'aal2',clock_timestamp()+interval '1 hour');perform set_config('request.jwt.claim.sub',owner_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'session_id',sid,'aal','aal2')::text,true);perform public.platform_set_essential_test_plan(c,'essential_pro');
 perform set_config('request.jwt.claim.sub',admin_user::text,true);execute 'set local role authenticated';
 denied:=false;begin perform public.prepare_essential_hr_document(c,'Private file','personal',worker);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Admin inherited confidential HR permissions';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_essential_hr_grant(c,admin_user,true,true,false,'Delegation RH autorisée');
 perform set_config('request.jwt.claim.sub',admin_user::text,true);denied:=false;begin perform public.prepare_essential_hr_document(c,'Personnel sans destinataire','personal');exception when others then denied:=true;end;if not denied then raise exception 'Personal document without recipient allowed';end if;d:=public.prepare_essential_hr_document(c,'Private file','personal',worker);
 denied:=false;begin perform public.publish_essential_hr_document(d.id);exception when others then denied:=true;end;if not denied then raise exception 'Published document without file';end if;
 execute 'reset role';insert into storage.objects(bucket_id,name,metadata) values('essential-hr',d.storage_path,'{"mimetype":"application/pdf","size":123}');execute 'set local role authenticated';perform public.publish_essential_hr_document(d.id);
 denied:=false;begin perform public.acknowledge_essential_hr_document(d.id);exception when others then denied:=true;end;if not denied then raise exception 'Manager acknowledged employee private file for self';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);if (select count(*) from public.essential_hr_documents where id=d.id)<>1 then raise exception 'Worker cannot see own file';end if;perform public.acknowledge_essential_hr_document(d.id);perform public.acknowledge_essential_hr_document(d.id);if (select count(*) from public.essential_hr_receipts where document_id=d.id)<>1 then raise exception 'Duplicate acknowledgement';end if;
 denied:=false;begin update storage.objects set name='overwrite.pdf' where bucket_id='essential-hr' and name=d.storage_path;exception when insufficient_privilege then denied:=true;end;-- zero affected rows is also an RLS denial
 perform set_config('request.jwt.claim.sub',outsider::text,true);if exists(select 1 from public.essential_hr_documents where company_id=c) then raise exception 'Other tenant sees files';end if;if exists(select 1 from storage.objects where bucket_id='essential-hr' and name=d.storage_path) then raise exception 'Other tenant sees file object';end if;
 perform set_config('request.jwt.claim.sub',admin_user::text,true);v:=public.prepare_essential_hr_document(c,'Private file revised','personal',null,null,true,d.id);if v.worker_id<>worker or v.version<>2 then raise exception 'Revision lost scope/version';end if;
 cert:=public.save_essential_certification(c,worker,'SIMDUT','training',current_date,current_date+30,d.id);
 denied:=false;begin perform public.save_essential_certification(c,worker,'SIMDUT','training',current_date,current_date+60,d.id,cert,99);exception when others then denied:=true;end;if not denied then raise exception 'Stale certification update accepted';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_essential_hr_grant(c,admin_user,false,false,false,'Fin de délégation');
 perform set_config('request.jwt.claim.sub',admin_user::text,true);if exists(select 1 from public.essential_hr_documents where id=d.id) then raise exception 'Revoked HR still sees private file';end if;
 perform set_config('request.jwt.claim.sub',emp::text,true);if (select count(*) from public.essential_certifications where id=cert)<>1 then raise exception 'Worker cannot see own certification';end if;
 execute 'reset role';if not exists(select 1 from storage.objects where bucket_id='essential-hr' and name=d.storage_path) then raise exception 'Published file was overwritten';end if;
end $$;
rollback;
