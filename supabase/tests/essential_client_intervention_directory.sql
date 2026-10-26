-- Two synthetic companies, a real assigned worker, >100 addresses and no destructive writes.
begin;
do $$
declare boss uuid:=gen_random_uuid();other_boss uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();
 company uuid;company_b uuid;client_id uuid;site_id uuid;client_b uuid;
 row jsonb;items jsonb;nextpage jsonb;firstlast uuid;denied boolean;v integer;
 customer_count integer;branches_before integer;jobs_before integer;shifts_before integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
  (boss,boss||'@client.test.invalid',now()),
  (other_boss,other_boss||'@client.test.invalid',now()),
  (employee,employee||'@client.test.invalid',now());
 perform set_config('request.jwt.claim.sub',boss::text,true);
 company:=public.create_company_for_edition('Client addresses A','essential');
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 company_b:=public.create_company_for_edition('Client addresses B','essential');
 update public.companies set is_test=true,billing_mode='test_simulated',billing_status='active',seat_limit=20
 where id in(company,company_b);
 insert into public.company_members(company_id,user_id,role,status)
 values(company,employee,'employee','active');
 select count(*) into branches_before from public.essential_locations where company_id=company;
 select count(*) into jobs_before from public.jobs where company_id=company;
 select count(*) into shifts_before from public.scheduled_shifts where company_id=company;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',boss::text,true);
 row:=public.save_essential_client(company,null,0,'Clinique Sourire','CLIENT-1','Nadine','418-000-0000',true);
 client_id:=(row->>'id')::uuid;
 if (row->>'version')::int<>1 then raise exception 'Client version missing';end if;
 row:=public.save_essential_client_site(company,null,0,client_id,
  'Entretien - étage 2','123 rue des Érables','Suite 201','Saint-Augustin-de-Desmaures',
  'Québec','G3A 0A1','CA','America/Toronto',null,null,
  'Nadine','418-000-0000','Entrée arrière, code à obtenir en privé','Clé au bureau',true);
 site_id:=(row->>'id')::uuid;
 if (row->>'version')::int<>1 then raise exception 'Site version missing';end if;
 row:=public.save_essential_client_site(company,site_id,1,client_id,
  'Entretien - étage 2','123 rue des Érables','Suite 202','Saint-Augustin-de-Desmaures',
  'Québec','G3A 0A1','CA','America/Toronto',46.76,-71.47,
  'Nadine','418-000-0000','Entrée arrière','Accès privé',true);
 if (row->>'version')::int<>2 then raise exception 'Site update version wrong';end if;
 denied:=false;
 begin perform public.save_essential_client_site(company,site_id,1,client_id,
  'Concurrent edit','123 rue des Érables','','Québec','','','CA','America/Toronto',
  null,null,'','','','',true);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Stale version overwrite allowed';end if;
 denied:=false;begin perform public.save_essential_client(company,client_id,1,'Clinique Sourire','','','',false);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Client archived despite active site';end if;
 row:=public.list_essential_clients(company,'Sourire',null,50);
 if jsonb_array_length(row->'items')<>1 or row->'items'->0->>'id'<>client_id::text then
   raise exception 'Client search incorrect: %',row;end if;
 row:=public.list_essential_client_sites(company,'Augus',null,50);
 if jsonb_array_length(row->'items')<>1 or row->'items'->0->>'id'<>site_id::text or
  row->'items'->0->>'unit'<>'Suite 202' then raise exception 'Site search incorrect: %',row;end if;
 -- Unlimited client addresses, keyset list bounded and complete.
 execute 'reset role';
 insert into public.essential_client_sites(company_id,client_id,name,address_line,city,region,timezone,updated_by)
 select company,client_id,'Visite '||i,'100 rue du Marché','Québec','QC','America/Toronto',boss
 from generate_series(1,106) i;
 execute 'set local role authenticated';
 row:=public.list_essential_client_sites(company,'',null,50);
 if jsonb_array_length(row->'items')<>50 or row->>'has_more'<>'true' then
   raise exception 'First page incomplete: %',row;end if;
 firstlast:=(row->'items'->49->>'id')::uuid;
 nextpage:=public.list_essential_client_sites(company,'',firstlast,100);
 if jsonb_array_length(nextpage->'items')<>57 or nextpage->>'has_more'<>'false' then
   raise exception 'Next page incorrect: %',nextpage;end if;
 if exists(select 1 from jsonb_array_elements(nextpage->'items') item where (item->>'id')::uuid<=firstlast)
 then raise exception 'Keyset pagination overlaps';end if;
 select count(*) into customer_count from public.essential_client_sites where company_id=company;
 if customer_count<>107 then raise exception 'Unexpected site count';end if;
 -- A customer at another company is never selectable.
 perform set_config('request.jwt.claim.sub',other_boss::text,true);
 row:=public.save_essential_client(company_b,null,0,'Other client','','','',true);
 client_b:=(row->>'id')::uuid;
 denied:=false;begin
  perform public.save_essential_client_site(company,null,0,client_b,
   'Other address','99 rue de Test','','Québec','','','CA','America/Toronto',null,null,'','','','',true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Company B managed company A';end if;
 denied:=false;begin perform public.list_essential_clients(company,'',null,50);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-tenant clients readable';end if;
 perform set_config('request.jwt.claim.sub',employee::text,true);
 denied:=false;begin perform public.list_essential_client_sites(company,'',null,50);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee read private client contact information';end if;
 denied:=false;begin perform public.save_essential_client(company,null,0,'Unauthorized','','','',true);
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee wrote client';end if;
 -- Archive preserves rows/history, including previous version and private metadata.
 perform set_config('request.jwt.claim.sub',boss::text,true);
 row:=public.save_essential_client_site(company,site_id,2,client_id,
 'Entretien - étage 2','123 rue des Érables','Suite 202','Saint-Augustin-de-Desmaures',
 'Québec','G3A 0A1','CA','America/Toronto',null,null,
 'Nadine','418-000-0000','Entrée arrière','Accès privé',false);
 if row->>'active'<>'false' or (row->>'version')::int<>3 then raise exception 'Archive did not preserve version';end if;
 -- The 106 other active sites prevent archiving the parent until each site is archived.
 denied:=false;begin perform public.save_essential_client(company,client_id,1,'Clinique Sourire','','','',false);
 exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Client archive bypassed other active sites';end if;
 if (select count(*) from public.essential_locations where company_id=company)<>branches_before or
    (select count(*) from public.jobs where company_id=company)<>jobs_before or
    (select count(*) from public.scheduled_shifts where company_id=company)<>shifts_before then
    raise exception 'Client directory must not create billed establishments/jobs/shifts';
 end if;
 execute 'reset role';
 if has_table_privilege('authenticated','public.essential_client_sites','select') or
    has_table_privilege('authenticated','public.essential_clients','select') then
   raise exception 'Sensitive customer tables exposed to Data API';end if;
 if has_function_privilege('anon','public.list_essential_client_sites(uuid,text,uuid,integer)','execute')
 then raise exception 'Anonymous can read customer address book';end if;
end $$;
rollback;
