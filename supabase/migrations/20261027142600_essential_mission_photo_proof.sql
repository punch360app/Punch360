-- MISSION-007/011/013 private photo proof. No existing company has photo required by default.
-- Storage objects are service-role-only. No authenticated/anon bucket policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mission-photo-evidence','mission-photo-evidence',false,5242880,array['image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
alter table private.essential_mission_settings
 add column completion_photo_required boolean not null default false;
create table private.essential_mission_photos(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 mission_id uuid not null,
 worker_id uuid not null,
 uploaded_by uuid not null references auth.users(id),
 mission_version integer not null check(mission_version>0),
 storage_path text not null unique,
 mime text check(mime in ('image/jpeg','image/png','image/webp')),
 bytes integer check(bytes between 16 and 5242880),
 state text not null default 'pending' check(state in ('pending','ready','linked')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '24 hours'),
 linked_at timestamptz,
 retention_until timestamptz,
 foreign key(company_id,mission_id) references private.essential_missions(company_id,id)
);
create index essential_mission_photos_scoped on private.essential_mission_photos(company_id,mission_id,state);
create unique index essential_mission_one_linked_photo on private.essential_mission_photos(company_id,mission_id) where state='linked';
alter table private.essential_mission_photos enable row level security;
revoke all on private.essential_mission_photos from public,anon,authenticated;
alter table private.essential_missions add column completion_photo_id uuid
 references private.essential_mission_photos(id);
create function public.set_essential_mission_photo_policy(p_company uuid,p_required boolean)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare previous boolean;
begin
 if not private.essential_mission_manager(p_company) then
  raise exception using errcode='42501',message='Réglage réservé au responsable';end if;
 if p_required is null then raise exception using errcode='22023',message='Choix de photo requis';end if;
 select completion_photo_required into previous from private.essential_mission_settings
 where company_id=p_company for update;
 if not found then
  insert into private.essential_mission_settings(company_id,enabled,updated_by,completion_photo_required)
  values(p_company,false,auth.uid(),p_required);
 else
  update private.essential_mission_settings set completion_photo_required=p_required,
  updated_by=auth.uid(),updated_at=clock_timestamp() where company_id=p_company;
 end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_photo_policy',p_company,
 jsonb_build_object('required',coalesce(previous,false)),
 jsonb_build_object('required',p_required),'Preuve photo privée, aucune modification du pointage');
 return jsonb_build_object('photo_required',p_required);
end $fn$;
create function public.prepare_essential_mission_photo(p_company uuid,p_mission uuid,p_version integer)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare m private.essential_missions; photo uuid;path text;
begin
 if not private.is_member(p_company) or p_mission is null or p_version is null or p_version<1
 or not exists(select 1 from private.essential_mission_settings where company_id=p_company and enabled)
 then raise exception using errcode='42501',message='Téléversement non autorisé';end if;
 select * into m from private.essential_missions where company_id=p_company and id=p_mission for share;
 if not found or m.status not in ('published','in_progress') or m.version<>p_version
 or not exists(select 1 from public.company_workers w where w.company_id=p_company and
  w.id=m.worker_id and w.auth_user_id=auth.uid() and w.status='active' and w.personal_access)
 then raise exception using errcode='42501',message='Mission ou salarié non autorisé';end if;
 photo:=gen_random_uuid();
 path:=p_company::text||'/'||p_mission::text||'/'||photo::text;
 insert into private.essential_mission_photos(id,company_id,mission_id,worker_id,uploaded_by,mission_version,storage_path)
 values(photo,p_company,p_mission,m.worker_id,auth.uid(),p_version,path);
 return jsonb_build_object('photo_id',photo,'path',path);
end $fn$;
-- Only server-side Edge client using service_role may attest actual validated bytes.
create function public.commit_essential_mission_photo_upload(p_photo uuid,p_mime text,p_bytes integer)
 returns void language plpgsql security definer set search_path='' as $fn$
begin
 if p_mime not in ('image/jpeg','image/png','image/webp') or p_bytes not between 16 and 5242880 then
  raise exception using errcode='22023',message='Image refusée';end if;
 update private.essential_mission_photos set state='ready',mime=p_mime,bytes=p_bytes
 where id=p_photo and state='pending' and expires_at>clock_timestamp();
 if not found then raise exception using errcode='22023',message='Téléversement expiré ou déjà confirmé';end if;
end $fn$;
create function public.get_essential_mission_photo_path(p_company uuid,p_photo uuid)
 returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_path text;v_mime text;
begin
 if not private.essential_mission_manager(p_company) then
  raise exception using errcode='42501',message='Preuve privée réservée au responsable';end if;
 select f.storage_path,f.mime into v_path,v_mime from private.essential_mission_photos f
 join private.essential_missions m on m.company_id=f.company_id and m.id=f.mission_id
 where f.company_id=p_company and f.id=p_photo and f.state='linked'
 and m.status='completed' and m.completion_photo_id=f.id
 and f.retention_until>clock_timestamp();
 if not found then raise exception using errcode='42501',message='Preuve privée inaccessible';end if;
 return jsonb_build_object('path',v_path,'mime',v_mime);
end $fn$;
revoke all on function public.set_essential_mission_photo_policy(uuid,boolean),
 public.prepare_essential_mission_photo(uuid,uuid,integer),
 public.commit_essential_mission_photo_upload(uuid,text,integer),
 public.get_essential_mission_photo_path(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_essential_mission_photo_policy(uuid,boolean),
 public.prepare_essential_mission_photo(uuid,uuid,integer),
 public.get_essential_mission_photo_path(uuid,uuid) to authenticated;
grant execute on function public.commit_essential_mission_photo_upload(uuid,text,integer) to service_role;
CREATE OR REPLACE FUNCTION public.complete_essential_mission_v4(p_company uuid, p_id uuid, p_version integer, p_request uuid, p_comment text, p_checklist jsonb, p_photo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.essential_missions;v_prev integer;v_worker uuid;former_status text;
 required boolean;proof text;checklist_required boolean;checklist_items jsonb;photo_required boolean;
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Compagnie non autorisée';end if;
 if p_id is null or p_request is null or p_version is null or p_version<=0 or
  not exists(select 1 from private.essential_mission_settings where company_id=p_company and enabled)
 then raise exception using errcode='22023',message='Mission ou demande invalide';end if;
 select * into v from private.essential_missions where company_id=p_company and id=p_id for update;
 if not found then raise exception using errcode='42501',message='Mission absente de cette compagnie';end if;
 select id into v_worker from public.company_workers w
  where w.company_id=p_company and w.id=v.worker_id and w.status='active' and w.personal_access and w.auth_user_id=auth.uid();
 if v_worker is null then raise exception using errcode='42501',message='Seul le salarié affecté peut terminer cette mission';end if;
 select result_version into v_prev from private.essential_mission_completions
  where company_id=p_company and mission_id=p_id and request_id=p_request and completed_by=auth.uid();
 if found then return jsonb_build_object('id',v.id,'version',v_prev,'status','completed','duplicate',true);end if;
 if v.status not in ('published','in_progress') or v.version<>p_version then
  raise exception using errcode='22023',message='Mission modifiée ou déjà terminée : actualisez la liste';end if;
 select completion_comment_required,completion_checklist_required,completion_checklist_items
  into required,checklist_required,checklist_items from private.essential_mission_settings
  where company_id=p_company for share;
 proof:=nullif(btrim(coalesce(p_comment,'')),'');
 if (coalesce(required,false) and (proof is null or length(proof)<5)) or
  (proof is not null and length(proof)>1000)
 then raise exception using errcode='22023',
  message='Commentaire de fin de mission requis (5 à 1000 caractères)';end if;
 if coalesce(checklist_required,false) and (p_checklist is null or p_checklist<>checklist_items)
 then raise exception using errcode='22023',
  message='Toutes les étapes de la checklist doivent être confirmées; actualisez la liste';end if;
 select completion_photo_required into photo_required from private.essential_mission_settings where company_id=p_company for share;
 if coalesce(photo_required,false) and p_photo is null then
  raise exception using errcode='22023',message='Photo de fin de mission obligatoire';end if;
 if p_photo is not null then
  perform 1 from private.essential_mission_photos f
  where f.id=p_photo and f.company_id=p_company and f.mission_id=p_id
   and f.worker_id=v.worker_id and f.uploaded_by=auth.uid() and f.mission_version=p_version
   and f.state='ready' and f.expires_at>clock_timestamp()
  for update;
  if not found then raise exception using errcode='42501',message='Photo privée absente, expirée ou non autorisée';end if;
 end if;
 former_status:=v.status;
 update private.essential_missions set status='completed',version=version+1,
  completed_by=auth.uid(),completed_at=clock_timestamp(),completion_comment=proof,
  completion_checklist=case when coalesce(checklist_required,false) then checklist_items else null end,
  completion_photo_id=p_photo,
  updated_by=auth.uid(),updated_at=clock_timestamp()
 where company_id=p_company and id=p_id returning * into v;
 if p_photo is not null then
  update private.essential_mission_photos set state='linked',linked_at=clock_timestamp(),retention_until=clock_timestamp()+interval '180 days'
  where id=p_photo and company_id=p_company;
 end if;
 insert into private.essential_mission_completions(company_id,mission_id,request_id,completed_by,result_version)
 values(p_company,p_id,p_request,auth.uid(),v.version);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(p_company,auth.uid(),'mission_completed',v.id,
  jsonb_build_object('version',p_version,'status',former_status),
  jsonb_build_object('version',v.version,'status','completed','proof_type',case when proof is not null then 'comment' else 'none' end,
   'checklist_confirmed',coalesce(checklist_required,false),'photo_saved',p_photo is not null),
  'Preuve de fin privée; aucune conséquence sur pointage, quart, heures, paie ou GPS');
 return jsonb_build_object('id',v.id,'version',v.version,'status','completed','duplicate',false,
  'proof_saved',proof is not null or coalesce(checklist_required,false) or p_photo is not null,
  'checklist_saved',coalesce(checklist_required,false),'photo_saved',p_photo is not null);
end $function$;

create or replace function public.complete_essential_mission_v3(p_company uuid,p_id uuid,p_version integer,p_request uuid,p_comment text,p_checklist jsonb)
 returns jsonb language sql security definer set search_path='' as $fn$
 select public.complete_essential_mission_v4(p_company,p_id,p_version,p_request,p_comment,p_checklist,null::uuid);
$fn$;
create or replace function public.complete_essential_mission_v2(p_company uuid,p_id uuid,p_version integer,p_request uuid,p_comment text)
 returns jsonb language sql security definer set search_path='' as $fn$
 select public.complete_essential_mission_v4(p_company,p_id,p_version,p_request,p_comment,null::jsonb,null::uuid);
$fn$;
create or replace function public.complete_essential_mission(p_company uuid,p_id uuid,p_version integer,p_request uuid)
 returns jsonb language sql security definer set search_path='' as $fn$
 select public.complete_essential_mission_v4(p_company,p_id,p_version,p_request,null::text,null::jsonb,null::uuid);
$fn$;
revoke all on function public.complete_essential_mission_v4(uuid,uuid,integer,uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.complete_essential_mission_v4(uuid,uuid,integer,uuid,text,jsonb,uuid) to authenticated;
CREATE OR REPLACE FUNCTION public.essential_missions_configuration(p_company uuid, p_enabled boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_enabled boolean;v_comment_required boolean;v_checklist_required boolean;v_checklist_items jsonb;v_photo_required boolean;
begin
 if not private.essential_mission_manager(p_company) then
  raise exception using errcode='42501',message='Module Missions réservé au responsable de cette compagnie';
 end if;
 if p_enabled is not null then
  insert into private.essential_mission_settings(company_id,enabled,updated_by)
  values(p_company,p_enabled,auth.uid())
  on conflict(company_id) do update set enabled=excluded.enabled,updated_by=auth.uid(),updated_at=clock_timestamp();
  insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason)
  values(p_company,auth.uid(),'mission_module_configuration',p_company,
   jsonb_build_object('enabled',p_enabled),'Activation explicite du module Missions (aucun contrat modifié)');
 end if;
 select enabled,completion_comment_required,completion_checklist_required,completion_checklist_items,completion_photo_required
 into v_enabled,v_comment_required,v_checklist_required,v_checklist_items,v_photo_required from private.essential_mission_settings where company_id=p_company;
 return jsonb_build_object('enabled',coalesce(v_enabled,false),'manual_only',true,'comment_required',coalesce(v_comment_required,false),
 'photo_required',coalesce(v_photo_required,false),'checklist_required',coalesce(v_checklist_required,false),'checklist_items',coalesce(v_checklist_items,'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.list_essential_missions(p_company uuid, p_day date, p_worker uuid DEFAULT NULL::uuid, p_include_drafts boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_manager boolean;v_worker uuid;v_result jsonb;v_count integer;
begin
 if not private.is_member(p_company) or not exists(
  select 1 from public.companies where id=p_company and product_edition='essential'
 ) then raise exception using errcode='42501',message='Missions non autorisées';end if;
 if p_day is null or p_day<current_date-30 or p_day>current_date+180 then
  raise exception using errcode='22023',message='Date de missions invalide';end if;
 v_manager:=private.essential_mission_manager(p_company);
 if not v_manager then
  if coalesce(p_include_drafts,false) then
   raise exception using errcode='42501',message='Brouillons réservés au responsable';end if;
  select id into v_worker from public.company_workers
  where company_id=p_company and auth_user_id=auth.uid() and status='active' and personal_access;
  if v_worker is null or (p_worker is not null and p_worker<>v_worker) then
   raise exception using errcode='42501',message='Compte personnel de mission requis';end if;
 else v_worker:=p_worker;end if;
 if not exists(select 1 from private.essential_mission_settings c where c.company_id=p_company and c.enabled)
 then return jsonb_build_object('enabled',false,'items','[]'::jsonb,'truncated',false);end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order,t.id),'[]'::jsonb),count(*)
 into v_result,v_count from (
  select m.id,m.company_id,m.worker_id,m.site_id,case when m.issue_postponed_from=p_day and m.mission_day<>p_day then p_day else m.mission_day end as mission_day,m.mission_day as effective_day,m.sort_order,m.title,case when m.issue_postponed_from=p_day and m.mission_day<>p_day then 'postponed' else m.status end as status,m.version,
   m.completed_at,m.started_at,case when v_manager and m.status='completed' then m.completion_photo_id else null end as completion_photo_id,case when v_manager then m.completion_comment else null end as completion_comment,
   case when v_manager then m.completion_checklist else null end as completion_checklist,m.issue_reason,m.issue_at,m.issue_decision,m.issue_decision_at,m.issue_decision_reason,m.issue_postponed_from,
   case when v_manager then m.issue_note else null end as issue_note,
   s.name as site_name,s.address_line,s.unit,s.city,s.region,s.postal_code,s.country,
   c.name as client_name,w.first_name,w.last_name
  from private.essential_missions m join public.essential_client_sites s
   on s.company_id=m.company_id and s.id=m.site_id
  join public.essential_clients c on c.company_id=s.company_id and c.id=s.client_id
  join public.company_workers w on w.company_id=m.company_id and w.id=m.worker_id
  where m.company_id=p_company and (m.mission_day=p_day or m.issue_postponed_from=p_day) and (v_worker is null or m.worker_id=v_worker)
   and (v_manager and coalesce(p_include_drafts,false) or m.status in ('published','in_progress','completed','impossible') or (m.status='cancelled' and m.issue_decision='cancel'))
  order by m.sort_order,m.id limit 201
 ) t;
 return jsonb_build_object('enabled',true,'comment_required',coalesce((select completion_comment_required from private.essential_mission_settings where company_id=p_company),false),
 'photo_required',coalesce((select completion_photo_required from private.essential_mission_settings where company_id=p_company),false),
 'checklist_required',coalesce((select completion_checklist_required from private.essential_mission_settings where company_id=p_company),false),
 'checklist_items',coalesce((select completion_checklist_items from private.essential_mission_settings where company_id=p_company),'[]'::jsonb),'items',(
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer,(value->>'id')),'[]'::jsonb)
  from (select value from jsonb_array_elements(v_result) limit 200) x
 ),'truncated',v_count>200);
end $function$;

