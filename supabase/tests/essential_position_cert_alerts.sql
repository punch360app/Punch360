begin;
do $test$
declare boss uuid:=gen_random_uuid();e1 uuid:=gen_random_uuid();e2 uuid:=gen_random_uuid();
 c uuid;l uuid;d uuid;w1 uuid;w2 uuid;s1 uuid;s2 uuid;pos uuid;pos2 uuid;v jsonb;denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at)
 values(boss,boss||'@exclusive-position.invalid',clock_timestamp()),
 (e1,e1||'@exclusive-position.invalid',clock_timestamp()),
 (e2,e2||'@exclusive-position.invalid',clock_timestamp());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 c:=public.create_company_for_edition('Synthetic exclusive positions','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=10 where id=c;
 insert into private.essential_test_plans(company_id,snapshot) select c,to_jsonb(p) from public.essential_plans p where id='essential_pro';
 insert into public.company_members(company_id,user_id,role) values(c,e1,'employee'),(c,e2,'employee');
 select id into w1 from public.company_workers where company_id=c and auth_user_id=e1;
 select id into w2 from public.company_workers where company_id=c and auth_user_id=e2;
 select id into l from public.essential_locations where company_id=c;
 d:=public.save_essential_department(c,l,'Réception');
 perform public.assign_essential_worker(w1,l,d);
 perform public.assign_essential_worker(w2,l,d);
 execute 'set local role authenticated';
 s1:=public.save_essential_local_shift(c,w1,l,d,'2026-11-09 08:00','2026-11-09 12:00','Poste accueil A');
 s2:=public.save_essential_local_shift(c,w2,l,d,'2026-11-09 09:00','2026-11-09 13:00','Poste accueil B');
 v:=public.save_essential_position(c,l,d,'Accueil','First aid',true,null,0,'Configuration synthétique');
 pos:=(v->>'id')::uuid;
 perform public.save_essential_certification(c,w1,'First aid','certification','2026-01-01','2027-12-31');
 v:=public.assign_essential_position(c,s1,pos,1,'Affectation validée');
 if v->>'position_id'<>pos::text or (v->>'version')::integer<>2 then raise exception 'Position assignment failed';end if;
 denied:=false;
 begin perform public.assign_essential_position(c,s2,pos,1,'Second poste simultané interdit');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Two overlapping assignments accepted';end if;
 v:=public.save_essential_position(c,l,d,'Cuisine',null,true,null,0,'Deuxième poste indépendant');
 pos2:=(v->>'id')::uuid;
 v:=public.assign_essential_position(c,s2,pos2,1,'Affectation du deuxième poste');
 if v->>'position_id'<>pos2::text then raise exception 'Independent post unavailable';end if;
 denied:=false;
 begin perform public.assign_essential_position(c,s2,pos,2,'Conflit simultané');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Concurrent position conflict ignored';end if;
 denied:=false;
 begin perform public.save_essential_position(c,l,d,'Accueil','First aid',false,pos,1,'Suppression alors que le quart futur existe');
 exception when others then denied:=true;end;
 if not denied then raise exception 'A position with future shifts was deactivated';end if;
 perform set_config('request.jwt.claim.sub',e1::text,true);
 denied:=false;
 begin perform public.save_essential_position(c,l,d,'Accès employé','First aid',true,null,0,'Accès salarié interdit');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Employee obtained position configuration';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 execute 'set local role authenticated';
 v:=public.essential_position_certification_alerts(c,'2026-11-09T00:00:00Z','2026-11-10T00:00:00Z');
 if (v->>'count')::integer<>0 then raise exception 'Valid certificate incorrectly flagged: %',v;end if;
 execute 'reset role';
 update public.essential_certifications set expires_on='2026-11-08' where company_id=c and worker_id=w1 and title='First aid';
 execute 'set local role authenticated';
 v:=public.essential_position_certification_alerts(c,'2026-11-09T00:00:00Z','2026-11-10T00:00:00Z');
 if (v->>'count')::integer<>1 or v->'items'->0->>'shift_id'<>s1::text or
    (v->>'read_only')::boolean<>true
 then raise exception 'Expired certificate not detected: %',v;end if;
 perform set_config('request.jwt.claim.sub',e1::text,true);
 denied:=false;
 begin perform public.essential_position_certification_alerts(c,'2026-11-09T00:00:00Z','2026-11-10T00:00:00Z');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Employee could read manager qualification alerts';end if;
 perform set_config('request.jwt.claim.sub',boss::text,true);
 denied:=false;
 begin perform public.essential_position_certification_alerts(c,'2026-11-01','2027-11-01');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Unbounded alert window accepted';end if;
 execute 'reset role';
end $test$;
rollback;
