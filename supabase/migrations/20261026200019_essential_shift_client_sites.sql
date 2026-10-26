-- MLOC-002/004/006 (partial): a client intervention address belongs to an
-- existing scheduled_shifts row, not to essential_locations or the default punch job.
-- No punch, GPS, payroll, payment, or automatic trip/transfer is created.
alter table public.scheduled_shifts
 add column client_site_id uuid,
 add constraint scheduled_shifts_company_client_site_fkey
 foreign key(company_id,client_site_id)
 references public.essential_client_sites(company_id,id);
create index scheduled_shifts_intervention_site_idx
 on public.scheduled_shifts(company_id,client_site_id,starts_at)
 where cancelled_at is null and client_site_id is not null;

create function public.set_essential_shift_client_site(
 p_company uuid,p_shift uuid,p_site uuid,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.scheduled_shifts;v_new_version integer;v_recipient uuid;v_label text;
begin
 if not private.is_manager(p_company) or
  not exists(select 1 from public.companies where id=p_company and product_edition='essential')
 then raise exception using errcode='42501',message='Gestionnaire Essentiel de la compagnie requis';end if;
 if p_shift is null or p_expected_version is null or p_expected_version<=0 then
  raise exception using errcode='22023',message='Quart et version attendue requis';end if;
 select * into v_shift from public.scheduled_shifts
 where id=p_shift and company_id=p_company for update;
 if not found or v_shift.cancelled_at is not null then
  raise exception using errcode='42501',message='Quart non autorisé ou annulé';end if;
 if v_shift.client_site_id is not distinct from p_site then
  if v_shift.version<>p_expected_version then
   raise exception using errcode='22023',message='Quart modifié, actualisez.';
  end if;
  return jsonb_build_object('shift_id',v_shift.id,'version',v_shift.version,'unchanged',true,'notified',false);
 end if;
 if v_shift.version<>p_expected_version then
  raise exception using errcode='22023',message='Quart modifié. Rechargez avant de changer le lieu.';
 end if;
 if p_site is not null then
  select s.name into v_label from public.essential_client_sites s
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id and c.active
  where s.id=p_site and s.company_id=p_company and s.active;
  if not found then
   raise exception using errcode='42501',message='Adresse active absente de cette compagnie';
  end if;
 else
  v_label:='Adresse d’intervention retirée';
 end if;
 update public.scheduled_shifts set client_site_id=p_site,version=version+1
 where id=v_shift.id returning version into v_new_version;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'shift_client_site_changed',p_shift,
  jsonb_build_object('client_site_id',v_shift.client_site_id,'version',v_shift.version),
  jsonb_build_object('client_site_id',p_site,'version',v_new_version),
  'Adresse d’intervention; horaires, jobs, pointages et GPS conservés');
 -- An actual published-address change alerts only the employee assigned to this shift,
 -- never the entire company. No private notes or contact phone in notifications.
 select w.auth_user_id into v_recipient
 from public.company_workers w join public.company_members m
 on m.company_id=w.company_id and m.user_id=w.auth_user_id and m.status='active'
 where w.company_id=p_company and w.id=v_shift.worker_id and w.status='active' and w.personal_access;
 if v_recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_recipient,'shift_site_changed','Lieu de votre quart modifié',
   'Consultez votre horaire du '||
   to_char(v_shift.starts_at at time zone v_shift.timezone,'YYYY-MM-DD HH24:MI')||
   '. Nouvelle affectation : '||left(v_label,100)||'.');
 end if;
 return jsonb_build_object('shift_id',v_shift.id,'version',v_new_version,
   'unchanged',false,'notified',v_recipient is not null);
end $$;

-- The employee reads only safe details for shifts personally assigned to them.
-- Manager can inspect assigned sites for the chosen company; direct site table stays private.
create function public.list_essential_assigned_client_sites(
 p_company uuid,p_from timestamptz,p_to timestamptz
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_count integer;
begin
 if not private.is_member(p_company) or
  not exists(select 1 from public.companies where id=p_company and product_edition='essential') then
  raise exception using errcode='42501',message='Compagnie Essentiel non autorisée';
 end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '120 days' then
  raise exception using errcode='22023',message='Période invalide (120 jours maximum)';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_at,t.shift_id),'[]'::jsonb),count(*)
 into v_result,v_count from (
  select sh.id as shift_id,sh.starts_at,sh.ends_at,sh.version as shift_version,
   sh.worker_id,sh.client_site_id,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   s.timezone as client_timezone,s.contact_name,s.contact_phone,s.access_instructions,
   c.name as client_name
  from public.scheduled_shifts sh
  join public.essential_client_sites s on s.company_id=sh.company_id and s.id=sh.client_site_id
  join public.essential_clients c on c.company_id=sh.company_id and c.id=s.client_id
  left join public.company_workers w on w.company_id=sh.company_id and w.id=sh.worker_id
  where sh.company_id=p_company and sh.client_site_id is not null and sh.cancelled_at is null
    and sh.starts_at<p_to and sh.ends_at>p_from
    and (private.is_manager(p_company) or
      (w.status='active' and w.personal_access and w.auth_user_id=auth.uid()))
  order by sh.starts_at,sh.id limit 1001
 ) t;
 return jsonb_build_object('items',(
   select coalesce(jsonb_agg(val order by (val->>'starts_at'),(val->>'shift_id')),'[]'::jsonb)
   from (select value val from jsonb_array_elements(v_result) value limit 1000) bounded
  ),'has_more',v_count>1000);
end $$;

revoke all on function public.set_essential_shift_client_site(uuid,uuid,uuid,integer) from public,anon;
revoke all on function public.list_essential_assigned_client_sites(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.set_essential_shift_client_site(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.list_essential_assigned_client_sites(uuid,timestamptz,timestamptz) to authenticated;
