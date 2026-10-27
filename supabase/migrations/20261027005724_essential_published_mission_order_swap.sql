-- MISSION-008/009: rearrange two already-published stops atomically
-- within the same worker/day/company. Never touch completed, impossible, draft
-- or cancelled missions, punch sessions, scheduled shifts, pay or customer data.
create function public.swap_essential_published_missions(
 p_company uuid,p_first uuid,p_first_version integer,
 p_second uuid,p_second_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_first private.essential_missions;v_second private.essential_missions;
 v_temp integer;v_count integer;v_recipient uuid;
begin
 if not private.essential_mission_manager(p_company) or
  not exists(select 1 from private.essential_mission_settings
    where company_id=p_company and enabled)
 then raise exception using errcode='42501',message='Ordre des missions réservé au Boss/Admin autorisé';end if;
 if p_first is null or p_second is null or p_first=p_second
    or p_first_version is null or p_second_version is null
    or p_first_version<1 or p_second_version<1 then
  raise exception using errcode='22023',message='Deux missions distinctes et leurs versions sont requises';
 end if;
 -- Serialize all route swaps inside one company; other non-swap writers still
 -- meet the unique-index and version checks, rolling back on any collision.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mission_route_swap:'||p_company::text,0));
 select * into v_first from private.essential_missions
 where company_id=p_company and id=p_first for update;
 select * into v_second from private.essential_missions
 where company_id=p_company and id=p_second for update;
 if v_first.id is null or v_second.id is null then
  raise exception using errcode='42501',message='Missions absentes de cette compagnie';end if;
 if v_first.version<>p_first_version or v_second.version<>p_second_version then
  raise exception using errcode='22023',message='Une mission a changé : rechargez la tournée avant de la réordonner';end if;
 if v_first.status<>'published' or v_second.status<>'published'
   or v_first.worker_id<>v_second.worker_id or v_first.mission_day<>v_second.mission_day
   or v_first.mission_day<current_date or v_first.mission_day>current_date+180 then
  raise exception using errcode='22023',message='Deux missions publiées du même salarié et du même jour sont requises';end if;
 if v_first.sort_order=v_second.sort_order then
  raise exception using errcode='22023',message='Ordre ambigu existant : corriger la tournée avant échange';end if;
 -- The existing partial unique index is non-deferrable. Find a genuinely free
 -- transient position; no intermediate status downgrade, published visibility
 -- or permanently changed rank is committed before this transaction succeeds.
 select n into v_temp from generate_series(1,999) n
 where not exists(select 1 from private.essential_missions m
   where m.company_id=p_company and m.worker_id=v_first.worker_id
    and m.mission_day=v_first.mission_day
    and m.status in ('published','completed') and m.sort_order=n)
 order by n desc limit 1;
 if v_temp is null then
  raise exception using errcode='22023',message='Tournée pleine : aucun rang temporaire libre pour échanger';end if;
 update private.essential_missions set sort_order=v_temp
 where company_id=p_company and id=v_first.id;
 update private.essential_missions set sort_order=v_first.sort_order,
   version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=v_second.id;
 update private.essential_missions set sort_order=v_second.sort_order,
   version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=v_first.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'published_mission_order_swapped',v_first.id,
 jsonb_build_object('first_id',v_first.id,'first_order',v_first.sort_order,'first_version',v_first.version,
  'second_id',v_second.id,'second_order',v_second.sort_order,'second_version',v_second.version),
 jsonb_build_object('first_order',v_second.sort_order,'first_version',v_first.version+1,
  'second_order',v_first.sort_order,'second_version',v_second.version+1),
 'Ordre des missions publiées du même salarié et jour; pointages et heures inchangés');
 select w.auth_user_id into v_recipient
 from public.company_workers w join public.company_members cm
   on cm.company_id=w.company_id and cm.user_id=w.auth_user_id and cm.status='active'
 where w.company_id=p_company and w.id=v_first.worker_id
   and w.status='active' and w.personal_access;
 if v_recipient is not null then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body)
  values(p_company,v_recipient,'mission_published','Ordre de votre tournée modifié',
   'Consultez à nouveau vos missions du '||to_char(v_first.mission_day,'YYYY-MM-DD')||
   '. Aucun pointage ni temps de travail n’a été modifié.');
 end if;
 return jsonb_build_object('first_id',v_first.id,'first_order',v_second.sort_order,
  'first_version',v_first.version+1,'second_id',v_second.id,'second_order',v_first.sort_order,
  'second_version',v_second.version+1,'worker_id',v_first.worker_id,
  'day',v_first.mission_day,'notified',v_recipient is not null);
end $$;
revoke all on function public.swap_essential_published_missions(uuid,uuid,integer,uuid,integer) from public,anon;
grant execute on function public.swap_essential_published_missions(uuid,uuid,integer,uuid,integer) to authenticated;