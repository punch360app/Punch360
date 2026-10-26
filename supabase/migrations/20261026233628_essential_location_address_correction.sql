-- NAV-002 (partial): correct the address of an EXISTING Essentiel establishment.
-- Never create a new branch, seat, job, shift or payment record.
-- The navigation address in essential_locations and its pre-existing jobs display
-- address are kept in sync; no geofence/coordinates are calculated or changed.
create function public.update_essential_location_address(
 p_company uuid,p_location uuid,p_expected_address text,p_new_address text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.essential_locations;
begin
 if p_company is null or p_location is null or
    not private.can_administer(p_company) or
    not exists(select 1 from public.companies c where c.id=p_company and c.product_edition='essential') then
  raise exception using errcode='42501',message='Adresse d’établissement réservée au responsable Essentiel';
 end if;
 if p_expected_address is null or p_new_address is null or
    length(btrim(p_new_address)) not between 6 and 240 or
    p_new_address ~ '[[:cntrl:]]' then
  raise exception using errcode='22023',message='Adresse invalide : entre 6 et 240 caractères, une seule ligne';
 end if;
 select * into current_row from public.essential_locations
  where id=p_location and company_id=p_company and active for update;
 if not found then
  raise exception using errcode='42501',message='Établissement actif non autorisé dans cette compagnie';
 end if;
 if coalesce(current_row.address,'')<>p_expected_address then
  raise exception using errcode='22023',message='Adresse modifiée entre-temps : actualisez et confirmez';
 end if;
 if coalesce(current_row.address,'')=btrim(p_new_address) then
  return jsonb_build_object('location_id',p_location,'unchanged',true,'navigation_updated',false);
 end if;
 update public.essential_locations set address=btrim(p_new_address)
  where id=p_location and company_id=p_company;
 -- Do not change a punch job's identity or its geofencing settings. Only its
 -- human-readable address is synchronized if the linked company job exists.
 if current_row.punch_job_id is not null then
  update public.jobs set address=btrim(p_new_address)
   where id=current_row.punch_job_id and company_id=p_company;
  if not found then raise exception using errcode='22023',message='Emplacement lié à un job introuvable';end if;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'essential_location_address_updated',p_location,
   jsonb_build_object('had_address',length(btrim(coalesce(current_row.address,'')))>0),
   jsonb_build_object('has_address',true,'gps_geofence_unchanged',true),
   'Adresse du lieu de travail corrigée, coordonnées GPS et sessions inchangées');
 return jsonb_build_object('location_id',p_location,'unchanged',false,'navigation_updated',true,
  'gps_geofence_unchanged',true);
end $$;
revoke all on function public.update_essential_location_address(uuid,uuid,text,text) from public,anon;
grant execute on function public.update_essential_location_address(uuid,uuid,text,text) to authenticated;
