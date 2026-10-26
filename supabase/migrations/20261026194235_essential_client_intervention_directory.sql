-- MLOC-001: clients and intervention addresses are UNLIMITED, NOT business branches.
-- They do not change essential_locations, jobs, billed sites or published shifts.
-- Access is exclusively via manager-authorized RPCs; contact and access notes are private.
create table public.essential_clients (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 name text not null check(length(btrim(name)) between 2 and 160),
 reference text not null default '' check(length(reference)<=60),
 contact_name text not null default '' check(length(contact_name)<=120),
 contact_phone text not null default '' check(length(contact_phone)<=35),
 active boolean not null default true,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references auth.users(id),
 unique(company_id,id)
);
create index essential_clients_directory on public.essential_clients(company_id,id);
alter table public.essential_clients enable row level security;
revoke all on public.essential_clients from public,anon,authenticated;

create table public.essential_client_sites (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 client_id uuid not null,
 name text not null check(length(btrim(name)) between 2 and 140),
 address_line text not null check(length(btrim(address_line)) between 3 and 180),
 unit text not null default '' check(length(unit)<=80),
 city text not null check(length(btrim(city)) between 2 and 120),
 region text not null default '' check(length(region)<=120),
 postal_code text not null default '' check(length(postal_code)<=25),
 country text not null default 'CA' check(length(country) between 2 and 3),
 timezone text not null,
 latitude double precision,
 longitude double precision,
 contact_name text not null default '' check(length(contact_name)<=120),
 contact_phone text not null default '' check(length(contact_phone)<=35),
 access_instructions text not null default '' check(length(access_instructions)<=1200),
 internal_notes text not null default '' check(length(internal_notes)<=1200),
 active boolean not null default true,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references auth.users(id),
 unique(company_id,id),
 foreign key(company_id,client_id) references public.essential_clients(company_id,id),
 check ((latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180))
);
create index essential_client_sites_directory on public.essential_client_sites(company_id,id);
create index essential_client_sites_by_client on public.essential_client_sites(company_id,client_id,active);
alter table public.essential_client_sites enable row level security;
revoke all on public.essential_client_sites from public,anon,authenticated;

create function private.can_manage_client_directory(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_manager(p_company) and exists(
  select 1 from public.companies c
   where c.id=p_company and c.product_edition='essential'
 )
$$;
revoke all on function private.can_manage_client_directory(uuid) from public,anon,authenticated;

create function public.save_essential_client(
 p_company uuid,p_id uuid,p_expected_version integer,
 p_name text,p_reference text,p_contact_name text,p_contact_phone text,p_active boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.essential_clients;v_before jsonb;v_created boolean:=false;
begin
 if not private.can_manage_client_directory(p_company) then
  raise exception using errcode='42501',message='Carnet clients réservé au responsable Essentiel';
 end if;
 if p_expected_version is null or p_expected_version<0 or
  length(btrim(coalesce(p_name,''))) not between 2 and 160 or
  length(coalesce(p_reference,''))>60 or
  length(coalesce(p_contact_name,''))>120 or length(coalesce(p_contact_phone,''))>35 or
  p_active is null then
  raise exception using errcode='22023',message='Fiche client invalide';
 end if;
 if p_id is null then
  if p_expected_version<>0 then raise exception using errcode='22023',message='Nouvelle fiche : version 0 requise';end if;
  insert into public.essential_clients(company_id,name,reference,contact_name,contact_phone,active,updated_by)
  values(p_company,btrim(p_name),btrim(coalesce(p_reference,'')),btrim(coalesce(p_contact_name,'')),
   btrim(coalesce(p_contact_phone,'')),p_active,auth.uid()) returning * into v;
  v_created:=true;
 else
  select * into v from public.essential_clients
    where company_id=p_company and id=p_id for update;
  if not found then raise exception using errcode='42501',message='Fiche client absente de la compagnie';end if;
  if v.version<>p_expected_version then raise exception using errcode='22023',message='Fiche modifiée. Actualisez avant d’enregistrer.';end if;
  if not p_active and exists(select 1 from public.essential_client_sites s
    where s.company_id=p_company and s.client_id=p_id and s.active) then
   raise exception using errcode='22023',message='Archivez les lieux actifs du client avant de l’archiver';
  end if;
  v_before:=jsonb_build_object('name',v.name,'reference',v.reference,'active',v.active,'version',v.version);
  update public.essential_clients set
   name=btrim(p_name),reference=btrim(coalesce(p_reference,'')),
   contact_name=btrim(coalesce(p_contact_name,'')),contact_phone=btrim(coalesce(p_contact_phone,'')),
   active=p_active,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
  where company_id=p_company and id=p_id returning * into v;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),case when v_created then 'client_created' else 'client_updated' end,
  v.id,v_before,jsonb_build_object('name',v.name,'version',v.version,'active',v.active),
  'Carnet des clients; aucune limite d’établissement ni contrat modifié');
 return jsonb_build_object('id',v.id,'version',v.version,'active',v.active,'created',v_created);
end $$;

create function public.save_essential_client_site(
 p_company uuid,p_id uuid,p_expected_version integer,p_client uuid,p_name text,
 p_address_line text,p_unit text,p_city text,p_region text,p_postal_code text,p_country text,
 p_timezone text,p_latitude double precision,p_longitude double precision,
 p_contact_name text,p_contact_phone text,p_access_instructions text,p_internal_notes text,
 p_active boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.essential_client_sites;v_before jsonb;v_created boolean:=false;
begin
 if not private.can_manage_client_directory(p_company) then
  raise exception using errcode='42501',message='Adresses clients réservées au responsable Essentiel';
 end if;
 if p_expected_version is null or p_expected_version<0 or p_client is null or
   length(btrim(coalesce(p_name,''))) not between 2 and 140 or
   length(btrim(coalesce(p_address_line,''))) not between 3 and 180 or
   length(btrim(coalesce(p_city,''))) not between 2 and 120 or
   length(coalesce(p_unit,''))>80 or length(coalesce(p_region,''))>120 or
   length(coalesce(p_postal_code,''))>25 or length(coalesce(p_country,'')) not between 2 and 3 or
   length(coalesce(p_contact_name,''))>120 or length(coalesce(p_contact_phone,''))>35 or
   length(coalesce(p_access_instructions,''))>1200 or length(coalesce(p_internal_notes,''))>1200 or
   (p_latitude is null)<>(p_longitude is null) or
   (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) or
   p_active is null or p_timezone is null or
   not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
   raise exception using errcode='22023',message='Lieu invalide (adresse, coordonnées ou fuseau)';
 end if;
 if not exists(select 1 from public.essential_clients c
  where c.company_id=p_company and c.id=p_client and c.active) then
  raise exception using errcode='42501',message='Client actif de la compagnie requis';
 end if;
 if p_id is null then
  if p_expected_version<>0 then raise exception using errcode='22023',message='Nouvelle adresse : version 0 requise';end if;
  insert into public.essential_client_sites(company_id,client_id,name,address_line,unit,city,region,
   postal_code,country,timezone,latitude,longitude,contact_name,contact_phone,
   access_instructions,internal_notes,active,updated_by)
  values(p_company,p_client,btrim(p_name),btrim(p_address_line),btrim(coalesce(p_unit,'')),
   btrim(p_city),btrim(coalesce(p_region,'')),btrim(coalesce(p_postal_code,'')),upper(btrim(p_country)),
   p_timezone,p_latitude,p_longitude,btrim(coalesce(p_contact_name,'')),
   btrim(coalesce(p_contact_phone,'')),btrim(coalesce(p_access_instructions,'')),
   btrim(coalesce(p_internal_notes,'')),p_active,auth.uid()) returning * into v;
  v_created:=true;
 else
  select * into v from public.essential_client_sites where company_id=p_company and id=p_id for update;
  if not found then raise exception using errcode='42501',message='Lieu absent de cette compagnie';end if;
  if v.version<>p_expected_version then raise exception using errcode='22023',message='Lieu modifié. Actualisez avant d’enregistrer.';end if;
  v_before:=jsonb_build_object('name',v.name,'client_id',v.client_id,'active',v.active,'version',v.version);
  update public.essential_client_sites set
   client_id=p_client,name=btrim(p_name),address_line=btrim(p_address_line),unit=btrim(coalesce(p_unit,'')),
   city=btrim(p_city),region=btrim(coalesce(p_region,'')),postal_code=btrim(coalesce(p_postal_code,'')),
   country=upper(btrim(p_country)),timezone=p_timezone,latitude=p_latitude,longitude=p_longitude,
   contact_name=btrim(coalesce(p_contact_name,'')),contact_phone=btrim(coalesce(p_contact_phone,'')),
   access_instructions=btrim(coalesce(p_access_instructions,'')),
   internal_notes=btrim(coalesce(p_internal_notes,'')),
   active=p_active,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp()
  where company_id=p_company and id=p_id returning * into v;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),case when v_created then 'client_site_created' else 'client_site_updated' end,
  v.id,v_before,jsonb_build_object('name',v.name,'client_id',v.client_id,'version',v.version,'active',v.active),
  'Adresse d’intervention; établissement, GPS et horaires inchangés');
 return jsonb_build_object('id',v.id,'version',v.version,'active',v.active,'created',v_created);
end $$;

-- Keyset pagination with exact-company manager checks; unlimited number of records.
create function public.list_essential_clients(
 p_company uuid,p_search text default '',p_after uuid default null,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;v_total integer;
begin
 if not private.can_manage_client_directory(p_company) then
  raise exception using errcode='42501',message='Carnet clients privé';
 end if;
 if p_limit is null or p_limit<1 or p_limit>100 or length(coalesce(p_search,''))>100 then
  raise exception using errcode='22023',message='Pagination ou recherche invalide';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb),count(*) into v,v_total
 from (select c.id,c.company_id,c.name,c.reference,c.contact_name,c.contact_phone,c.active,
   c.version,c.updated_at
  from public.essential_clients c
  where c.company_id=p_company and (p_after is null or c.id>p_after)
   and (coalesce(p_search,'')='' or c.name ilike '%'||p_search||'%' or c.reference ilike '%'||p_search||'%')
  order by c.id limit p_limit+1) t;
 return jsonb_build_object('items',(select coalesce(jsonb_agg(x order by (x->>'id')),'[]'::jsonb)
  from (select value x from jsonb_array_elements(v) value limit p_limit) limited),
  'has_more',v_total>p_limit);
end $$;
create function public.list_essential_client_sites(
 p_company uuid,p_search text default '',p_after uuid default null,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;v_total integer;
begin
 if not private.can_manage_client_directory(p_company) then
  raise exception using errcode='42501',message='Adresses clients privées';
 end if;
 if p_limit is null or p_limit<1 or p_limit>100 or length(coalesce(p_search,''))>100 then
  raise exception using errcode='22023',message='Pagination ou recherche invalide';
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb),count(*) into v,v_total
 from (select s.id,s.company_id,s.client_id,s.name,s.address_line,s.unit,s.city,
   s.region,s.postal_code,s.country,s.timezone,s.latitude,s.longitude,
   s.contact_name,s.contact_phone,s.access_instructions,s.internal_notes,
   s.active,s.version,s.updated_at,c.name as client_name
  from public.essential_client_sites s join public.essential_clients c
   on c.company_id=s.company_id and c.id=s.client_id
  where s.company_id=p_company and (p_after is null or s.id>p_after)
   and (coalesce(p_search,'')='' or s.name ilike '%'||p_search||'%' or
    s.city ilike '%'||p_search||'%' or s.address_line ilike '%'||p_search||'%' or
    c.name ilike '%'||p_search||'%')
  order by s.id limit p_limit+1) t;
 return jsonb_build_object('items',(select coalesce(jsonb_agg(x order by (x->>'id')),'[]'::jsonb)
  from (select value x from jsonb_array_elements(v) value limit p_limit) limited),
  'has_more',v_total>p_limit);
end $$;

revoke all on function public.save_essential_client(uuid,uuid,integer,text,text,text,text,boolean) from public,anon;
revoke all on function public.save_essential_client_site(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,text,boolean) from public,anon;
revoke all on function public.list_essential_clients(uuid,text,uuid,integer) from public,anon;
revoke all on function public.list_essential_client_sites(uuid,text,uuid,integer) from public,anon;
grant execute on function public.save_essential_client(uuid,uuid,integer,text,text,text,text,boolean) to authenticated;
grant execute on function public.save_essential_client_site(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,double precision,double precision,text,text,text,text,boolean) to authenticated;
grant execute on function public.list_essential_clients(uuid,text,uuid,integer) to authenticated;
grant execute on function public.list_essential_client_sites(uuid,text,uuid,integer) to authenticated;
