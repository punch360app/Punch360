-- Exclusive positions for Essentiel Pro. Existing shifts without position_id remain unchanged.
create table public.essential_positions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 location_id uuid not null,
 department_id uuid,
 title text not null check(length(btrim(title)) between 2 and 100),
 required_certificate text check(required_certificate is null or length(btrim(required_certificate)) between 2 and 140),
 active boolean not null default true,
 version integer not null default 1 check(version>=1),
 created_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(company_id,location_id) references public.essential_locations(company_id,id),
 foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
create unique index essential_positions_unique_name on public.essential_positions(company_id,location_id,lower(btrim(title))) where active;
alter table public.essential_positions enable row level security;
create policy essential_positions_manager_read on public.essential_positions for select to authenticated using
 (private.is_manager(company_id) and private.essential_member_feature(company_id,'minimum_coverage'));
grant select on public.essential_positions to authenticated;
revoke all on public.essential_positions from anon;
revoke insert,update,delete on public.essential_positions from authenticated;

alter table public.scheduled_shifts add column position_id uuid references public.essential_positions(id);
create index scheduled_shifts_position_period on public.scheduled_shifts(company_id,position_id,starts_at,ends_at)
 where position_id is not null and cancelled_at is null;

create function private.essential_position_shift_guard() returns trigger
 language plpgsql security definer set search_path='' as $fn$
declare pos public.essential_positions;zone text;
begin
 if new.position_id is null or new.cancelled_at is not null then return new;end if;
 select * into pos from public.essential_positions where id=new.position_id and company_id=new.company_id and active;
 if not found then raise exception using errcode='22023',message='Poste exclusif inconnu ou désactivé';end if;
 if pos.location_id is distinct from new.location_id or
   (pos.department_id is not null and pos.department_id is distinct from new.department_id)
 then raise exception using errcode='22023',message='Poste hors établissement ou département';end if;
 if not private.essential_feature(new.company_id,'minimum_coverage') then raise exception using errcode='42501',message='Postes exclusifs réservés à Essentiel Pro';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('exclusive-position:'||new.company_id::text||':'||pos.id::text,0));
 if exists(select 1 from public.scheduled_shifts s where s.company_id=new.company_id and s.position_id=pos.id
   and s.id<>new.id and s.cancelled_at is null
   and pg_catalog.tstzrange(s.starts_at,s.ends_at,'[)')&&pg_catalog.tstzrange(new.starts_at,new.ends_at,'[)'))
 then raise exception using errcode='22023',message='Poste déjà occupé sur ce créneau';end if;
 if new.worker_id is not null and pos.required_certificate is not null then
  select timezone into zone from public.essential_locations where company_id=new.company_id and id=new.location_id;
  if not exists(select 1 from public.essential_certifications cert
   where cert.company_id=new.company_id and cert.worker_id=new.worker_id
   and lower(btrim(cert.title))=lower(btrim(pos.required_certificate))
   and cert.issued_on<=(new.starts_at at time zone zone)::date
   and (cert.expires_on is null or cert.expires_on>=((new.ends_at-interval '1 microsecond') at time zone zone)::date))
  then raise exception using errcode='22023',message='Certification requise absente ou expirée';end if;
 end if;
 return new;
end $fn$;
revoke all on function private.essential_position_shift_guard() from public,anon,authenticated;
create trigger essential_position_shift_guard after insert or update of company_id,position_id,worker_id,location_id,department_id,starts_at,ends_at,cancelled_at
on public.scheduled_shifts for each row execute function private.essential_position_shift_guard();

create function public.save_essential_position(
 p_company uuid,p_location uuid,p_department uuid,p_title text,p_certificate text,p_active boolean,
 p_id uuid,p_expected_version integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare old public.essential_positions;result public.essential_positions;
begin
 if not private.can_administer(p_company) or not private.essential_feature(p_company,'minimum_coverage')
 then raise exception using errcode='42501',message='Gestionnaire Essentiel Pro requis';end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 1000
 or length(btrim(coalesce(p_title,''))) not between 2 and 100
 or p_active is null or p_expected_version is null or p_expected_version<0
 then raise exception using errcode='22023',message='Nom, statut, version et motif requis';end if;
 perform 1 from public.companies where id=p_company and product_edition='essential' for update;
 if not found then raise exception using errcode='42501',message='Entreprise Essentiel requise';end if;
 if not exists(select 1 from public.essential_locations where company_id=p_company and id=p_location and active)
 then raise exception using errcode='22023',message='Établissement actif requis';end if;
 if p_department is not null and not exists(select 1 from public.essential_departments
    where company_id=p_company and id=p_department and location_id=p_location and active)
 then raise exception using errcode='22023',message='Département du même établissement requis';end if;
 if p_certificate is not null and length(btrim(p_certificate)) not between 2 and 140 then
  raise exception using errcode='22023',message='Certification invalide';end if;
 if p_id is not null then
  select * into old from public.essential_positions where id=p_id and company_id=p_company for update;
  if not found then raise exception using errcode='22023',message='Poste introuvable';end if;
 end if;
 if coalesce(old.version,0)<>p_expected_version then raise exception using errcode='40001',message='Poste modifié : actualiser';end if;
 if old.id is not null and (
  old.location_id is distinct from p_location or old.department_id is distinct from p_department
  or old.required_certificate is distinct from nullif(btrim(p_certificate),'') or not p_active
 ) and exists(select 1 from public.scheduled_shifts where company_id=p_company and position_id=old.id and cancelled_at is null and ends_at>clock_timestamp())
 then raise exception using errcode='22023',message='Désaffecter les quarts futurs avant de changer ce poste';end if;
 if old.id is null then
  insert into public.essential_positions(company_id,location_id,department_id,title,required_certificate,active,created_by)
  values(p_company,p_location,p_department,btrim(p_title),nullif(btrim(p_certificate),''),p_active,auth.uid())
  returning * into result;
 else
  update public.essential_positions set location_id=p_location,department_id=p_department,title=btrim(p_title),
    required_certificate=nullif(btrim(p_certificate),''),active=p_active,version=version+1,updated_at=clock_timestamp()
  where id=old.id returning * into result;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'exclusive_position_saved',result.id,btrim(p_reason));
 return jsonb_build_object('id',result.id,'version',result.version,'active',result.active);
end $fn$;

create function public.assign_essential_position(
 p_company uuid,p_shift uuid,p_position uuid,p_expected_version integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare sh public.scheduled_shifts;result public.scheduled_shifts;
begin
 if not private.can_administer(p_company) or not private.essential_feature(p_company,'minimum_coverage')
 then raise exception using errcode='42501',message='Gestionnaire Essentiel Pro requis';end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 1000 or p_expected_version is null
 then raise exception using errcode='22023',message='Version et motif requis';end if;
 perform 1 from public.companies where id=p_company and product_edition='essential' for update;
 if not found then raise exception using errcode='42501',message='Entreprise requise';end if;
 select * into sh from public.scheduled_shifts where id=p_shift and company_id=p_company for update;
 if not found or sh.cancelled_at is not null then raise exception using errcode='22023',message='Quart actif requis';end if;
 if sh.version<>p_expected_version then raise exception using errcode='40001',message='Quart modifié : actualiser';end if;
 update public.scheduled_shifts set position_id=p_position,version=version+1 where id=sh.id returning * into result;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason)
 values(p_company,auth.uid(),'exclusive_position_assigned',result.id,btrim(p_reason));
 return jsonb_build_object('shift_id',result.id,'position_id',result.position_id,'version',result.version);
end $fn$;
revoke all on function public.save_essential_position(uuid,uuid,uuid,text,text,boolean,uuid,integer,text),
public.assign_essential_position(uuid,uuid,uuid,integer,text) from public,anon;
grant execute on function public.save_essential_position(uuid,uuid,uuid,text,text,boolean,uuid,integer,text),
public.assign_essential_position(uuid,uuid,uuid,integer,text) to authenticated;
