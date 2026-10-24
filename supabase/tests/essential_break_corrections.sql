begin;
do $$
declare boss uuid:=gen_random_uuid();emp uuid:=gen_random_uuid();other_user uuid:=gen_random_uuid();c uuid;other_company uuid;w uuid;s uuid;j uuid;b uuid;req uuid:=gen_random_uuid();newreq uuid:=gen_random_uuid();denied boolean;n integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values(boss,boss||'@test.invalid',now()),(emp,emp||'@test.invalid',now()),(other_user,other_user||'@test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);c:=public.create_company_for_edition('Pause corrections fixture','essential');update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;insert into public.company_members(company_id,user_id,role) values(c,emp,'employee');select id into w from public.company_workers where company_id=c and auth_user_id=emp;select default_punch_job_id into j from public.companies where id=c;
 insert into public.punch_sessions(company_id,user_id,worker_id,started_at,ended_at) values(c,emp,w,'2026-10-05 08:00-04','2026-10-05 16:00-04') returning id into s;
 insert into public.punch_segments(company_id,session_id,job_id,started_at,ended_at) values(c,s,j,'2026-10-05 08:00-04','2026-10-05 16:00-04');
 insert into public.punch_breaks(company_id,session_id,user_id,started_at,ended_at) values(c,s,emp,'2026-10-05 12:00-04','2026-10-05 12:30-04') returning id into b;
 perform set_config('request.jwt.claim.sub',emp::text,true);execute 'set local role authenticated';
 perform public.request_essential_break_correction(req,s,b,'2026-10-05 12:05-04','2026-10-05 12:35-04',true,'Pause payée selon la politique');perform public.request_essential_break_correction(req,s,b,'2026-10-05 12:05-04','2026-10-05 12:35-04',true,'Pause payée selon la politique');
 if (select is_paid from public.punch_breaks where id=b) then raise exception 'Submission changed official pause';end if;
 select count(*) into n from public.essential_break_corrections where id=req;if n<>1 then raise exception 'Request duplicated';end if;
 denied:=false;begin perform public.review_essential_break_correction(req,true,'Auto approbation');exception when others then denied:=true;end;if not denied then raise exception 'Employee approved';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;begin perform public.set_payroll_week(c,'2026-10-05',true,'Fermeture de test');exception when others then denied:=true;end;if not denied then raise exception 'Closed with pending pause';end if;
 perform public.review_essential_break_correction(req,true,'Vérification du responsable');
 if not (select is_paid from public.punch_breaks where id=b) or (select started_at from public.punch_breaks where id=b)<>'2026-10-05 12:05-04'::timestamptz then raise exception 'Approval not applied';end if;
 if not exists(select 1 from public.workforce_audit where entity_id=b and action='break_correction_applied' and before_value->>'is_paid'='false') then raise exception 'Original pause not audited';end if;
 denied:=false;begin perform public.request_essential_break_correction(gen_random_uuid(),s,null,'2026-10-05 12:00-04','2026-10-05 12:15-04',false,'Pause qui chevauche');exception when others then denied:=true;end;if not denied then raise exception 'Overlap accepted';end if;
 -- Boss may propose for a kiosk-only person, but cannot approve the same request.
 perform public.request_essential_break_correction(newreq,s,null,'2026-10-05 10:00-04','2026-10-05 10:15-04',false,'Ajout pause oubliée');
 denied:=false;begin perform public.review_essential_break_correction(newreq,true,'Ma propre demande');exception when others then denied:=true;end;if not denied then raise exception 'Self approval accepted';end if;perform public.cancel_essential_break_correction(newreq);
 perform set_config('request.jwt.claim.sub',emp::text,true);newreq:=gen_random_uuid();perform public.request_essential_break_correction(newreq,s,null,'2026-10-05 10:00-04','2026-10-05 10:15-04',false,'Ajout pause oubliée');
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.review_essential_break_correction(newreq,true,'Pause ajoutée après vérification');
 perform public.set_payroll_week(c,'2026-10-05',true,'Fermeture de test');
 perform set_config('request.jwt.claim.sub',emp::text,true);denied:=false;begin perform public.request_essential_break_correction(gen_random_uuid(),s,b,'2026-10-05 12:10-04','2026-10-05 12:40-04',true,'Semaine fermée');exception when others then denied:=true;end;if not denied then raise exception 'Closed week modified';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);perform public.set_payroll_week(c,'2026-10-05',false,'Réouverture motivée');
 execute 'reset role';denied:=false;begin update public.punch_sessions set ended_at='2026-10-05 12:10-04' where id=s;exception when others then denied:=true;end;if not denied then raise exception 'Session correction stranded pause';end if;
 -- A session changed after a request requires a fresh request, preserving the official pause.
 perform set_config('request.jwt.claim.sub',emp::text,true);newreq:=gen_random_uuid();perform public.request_essential_break_correction(newreq,s,b,'2026-10-05 12:10-04','2026-10-05 12:40-04',true,'Correction avant changement');update public.punch_sessions set ended_at='2026-10-05 16:05-04' where id=s;
 perform set_config('request.jwt.claim.sub',boss::text,true);denied:=false;begin perform public.review_essential_break_correction(newreq,true,'Demande devenue périmée');exception when others then denied:=true;end;if not denied then raise exception 'Stale request applied';end if;
 perform set_config('request.jwt.claim.sub',other_user::text,true);other_company:=public.create_company_for_edition('Other pause tenant','essential');execute 'set local role authenticated';
 if exists(select 1 from public.essential_break_corrections where company_id=c) then raise exception 'Cross tenant requests visible';end if;
 denied:=false;begin perform public.request_essential_break_correction(gen_random_uuid(),s,null,'2026-10-05 09:00-04','2026-10-05 09:15-04',false,'Cross tenant request');exception when others then denied:=true;end;if not denied then raise exception 'Cross tenant mutation accepted';end if;
 execute 'reset role';
end $$;
rollback;
