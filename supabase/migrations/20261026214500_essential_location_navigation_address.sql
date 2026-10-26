-- NAV-002 partial: managers can correct the navigation address of an EXISTING
-- establishment without creating a billable location or changing its punch job/GPS.
alter table public.essential_locations
 add column navigation_address_version integer not null default 1
   check(navigation_address_version>0),
 add column address_components jsonb not null default '{}'::jsonb
   check(jsonb_typeof(address_components)='object');

create function public.set_essential_location_navigation_address(
 p_company uuid,p_location uuid,p_expected_version integer,
 p_address_line text,p_unit text,p_city text,p_region text,p_postal_code text,
 p_country text,p_timezone text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.essential_locations;v_parts jsonb;v_address text;
begin
 if not private.can_administer(p_company) or not exists(
  select 1 from public.companies c where c.id=p_company and c.product_edition='essential'
 ) then raise exception using errcode='42501',message='Adresse réservée au Boss/Admin Essentiel';end if;
 if p_location is null or p_expected_version is null or p_expected_version<1
    or length(btrim(coalesce(p_address_line,''))) not between 3 and 180
    or length(btrim(coalesce(p_city,''))) not between 2 and 120
    or length(coalesce(p_unit,''))>80
    or length(coalesce(p_region,''))>120
    or length(coalesce(p_postal_code,''))>25
    or length(btrim(coalesce(p_country,''))) not between 2 and 3
    or p_timezone is null or not exists(
       select 1 from pg_catalog.pg_timezone_names where name=p_timezone)
 then raise exception using errcode='22023',message='Adresse professionnelle structurée ou fuseau invalide';end if;
 select * into v from public.essential_locations
 where id=p_location and company_id=p_company and active for update;
 if not found then raise exception using errcode='42501',message='Établissement actif absent de votre compagnie';end if;
 if v.navigation_address_version<>p_expected_version then
  raise exception using errcode='22023',message='Adresse modifiée par un autre responsable. Rechargez avant de sauvegarder.';end if;
 v_parts:=jsonb_build_object(
  'line',btrim(p_address_line),'unit',btrim(coalesce(p_unit,'')),
  'city',btrim(p_city),'region',btrim(coalesce(p_region,'')),
  'postal_code',btrim(coalesce(p_postal_code,'')),
  'country',upper(btrim(p_country)));
 v_address:=concat_ws(', ',nullif(v_parts->>'line',''),nullif(v_parts->>'unit',''),
  nullif(v_parts->>'city',''),nullif(v_parts->>'region',''),
  nullif(v_parts->>'postal_code',''),nullif(v_parts->>'country',''));
 if v.address=v_address and v.address_components=v_parts and v.timezone=p_timezone then
  return jsonb_build_object('id',v.id,'version',v.navigation_address_version,
    'address',v.address,'timezone',v.timezone,'unchanged',true);
 end if;
 update public.essential_locations set address=v_address,
  address_components=v_parts,timezone=p_timezone,
  navigation_address_version=navigation_address_version+1
 where id=v.id and company_id=p_company;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'location_navigation_address_updated',v.id,
  jsonb_build_object('version',v.navigation_address_version,'timezone',v.timezone),
  jsonb_build_object('version',v.navigation_address_version+1,'timezone',p_timezone),
  'Correction navigation uniquement : établissement, punch_job_id et périmètre GPS inchangés');
 return jsonb_build_object('id',v.id,'version',v.navigation_address_version+1,
   'address',v_address,'timezone',p_timezone,'unchanged',false);
end $$;
revoke all on function public.set_essential_location_navigation_address(
 uuid,uuid,integer,text,text,text,text,text,text,text
) from public,anon;
grant execute on function public.set_essential_location_navigation_address(
 uuid,uuid,integer,text,text,text,text,text,text,text
) to authenticated;
