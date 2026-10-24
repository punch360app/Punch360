create table public.essential_shift_requests (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,worker_id uuid not null,shift_id uuid not null,
 kind text not null check(kind in ('claim','release','swap')),other_shift_id uuid,other_worker_id uuid,
 source_version integer not null,other_version integer,status text not null default 'pending' check(status in ('pending','accepted','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),reviewed_by uuid,reviewed_at timestamptz,review_note text,
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),
 foreign key(company_id,other_worker_id) references public.company_workers(company_id,id),
 foreign key(company_id,shift_id) references public.scheduled_shifts(company_id,id),
 foreign key(company_id,other_shift_id) references public.scheduled_shifts(company_id,id),
 check((kind='swap')=(other_shift_id is not null and other_worker_id is not null))
);
create unique index one_pending_shift_request on public.essential_shift_requests(company_id,worker_id,shift_id,kind) where status in ('pending','accepted');
alter table public.essential_shift_requests enable row level security;
create policy shift_requests_scoped_read on public.essential_shift_requests for select to authenticated using(private.is_member(company_id) and
 (exists(select 1 from public.company_workers w where w.id in (worker_id,other_worker_id) and w.auth_user_id=auth.uid() and w.status='active') or private.is_manager(company_id) or exists(select 1 from public.scheduled_shifts s where s.id=shift_id and private.essential_can_plan(s.company_id,s.department_id))));
grant select on public.essential_shift_requests to authenticated;
revoke insert,update,delete on public.essential_shift_requests from anon,authenticated;
create function public.request_essential_shift_change(p_shift uuid,p_kind text,p_other uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.scheduled_shifts;t public.scheduled_shifts;w public.company_workers;v_id uuid;
begin
 select * into s from public.scheduled_shifts where id=p_shift;
 if not found or not private.is_member(s.company_id) or not private.essential_feature(s.company_id,'shift_swaps') then raise exception using errcode='42501',message='Changement de quart non autorisé';end if;
 select * into w from public.company_workers where company_id=s.company_id and auth_user_id=auth.uid() and status='active' and personal_access and role in ('employee','lead','boss');
 if not found or s.cancelled_at is not null or s.starts_at<=clock_timestamp() or p_kind is null or p_kind not in ('claim','release','swap') then raise exception 'Demande invalide';end if;
 if (p_kind='claim' and s.worker_id is not null) or (p_kind in ('release','swap') and s.worker_id is distinct from w.id) then raise exception 'Quart non admissible';end if;
 if p_kind='swap' then
 select * into t from public.scheduled_shifts where company_id=s.company_id and id=p_other and worker_id is not null and worker_id<>w.id and cancelled_at is null and starts_at>clock_timestamp();
 if not found or t.department_id is distinct from s.department_id or t.location_id is distinct from s.location_id then raise exception 'Échange limité au même établissement et département';end if;
 end if;
 insert into public.essential_shift_requests(company_id,worker_id,shift_id,kind,other_shift_id,other_worker_id,source_version,other_version)
 values(s.company_id,w.id,s.id,p_kind,t.id,t.worker_id,s.version,t.version) returning id into v_id;
 if t.user_id is not null then insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(s.company_id,t.user_id,'shift_request','Proposition d’échange de quarts','Votre accord est requis avant l’approbation du responsable.');end if;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(s.company_id,auth.uid(),'shift_change_requested',v_id,jsonb_build_object('kind',p_kind,'shift',s.id),'Aucune affectation officielle modifiée');return v_id;
end $$;
create function public.answer_essential_swap(p_request uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_shift_requests;
begin
 select * into r from public.essential_shift_requests where id=p_request for update;
 if not found or r.kind<>'swap' or r.status<>'pending' or p_accept is null or not private.is_member(r.company_id) or not exists(select 1 from public.company_workers where id=r.other_worker_id and auth_user_id=auth.uid() and status='active' and personal_access) then raise exception using errcode='42501',message='Réponse du collègue destinataire requise';end if;
 update public.essential_shift_requests set status=case when p_accept then 'accepted' else 'rejected' end where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(r.company_id,auth.uid(),'shift_swap_answer',r.id,jsonb_build_object('accepted',p_accept),'Réponse du collègue, en attente du responsable si acceptée');
end $$;
create function public.review_essential_shift_request(p_request uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_shift_requests;s public.scheduled_shifts;t public.scheduled_shifts;v_key text;v_recipient uuid;
begin
 select * into r from public.essential_shift_requests where id=p_request for update;
 if not found or r.status not in ('pending','accepted') or p_approve is null or length(trim(coalesce(p_note,'')))<3 then raise exception 'Demande traitée ou motif manquant';end if;
 -- Lock all affected rows in a deterministic order before taking worker locks.
 perform 1 from public.scheduled_shifts where id in (r.shift_id,r.other_shift_id) order by id for update;
 select * into s from public.scheduled_shifts where id=r.shift_id;
 if not private.essential_can_plan(r.company_id,s.department_id) then raise exception using errcode='42501',message='Responsable autorisé requis';end if;
 if exists(select 1 from public.company_workers where id in (r.worker_id,r.other_worker_id) and auth_user_id=auth.uid()) then raise exception using errcode='42501',message='Autoapprobation interdite';end if;
 if r.kind='swap' then select * into t from public.scheduled_shifts where id=r.other_shift_id;
 if not private.essential_can_plan(r.company_id,t.department_id) then raise exception using errcode='42501',message='Responsable des deux départements requis';end if;end if;
 if p_approve then
 if s.cancelled_at is not null or s.version<>r.source_version or s.starts_at<=clock_timestamp() then raise exception 'Le quart a changé depuis la demande';end if;
 for v_key in select 'schedule:'||w.company_id::text||coalesce(w.auth_user_id,w.id)::text from public.company_workers w where w.id in (r.worker_id,r.other_worker_id) order by coalesce(w.auth_user_id,w.id)::text loop perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));end loop;
 if r.kind='claim' then
 if s.worker_id is not null then raise exception 'Quart déjà attribué';end if;
 update public.scheduled_shifts set worker_id=r.worker_id,user_id=null,version=version+1 where id=s.id;
 elsif r.kind='release' then
 if s.worker_id is distinct from r.worker_id then raise exception 'Affectation modifiée';end if;
 update public.scheduled_shifts set worker_id=null,user_id=null,version=version+1 where id=s.id;
 else
 if r.status<>'accepted' or t.version is distinct from r.other_version or t.cancelled_at is not null or t.starts_at<=clock_timestamp() or s.worker_id is distinct from r.worker_id or t.worker_id is distinct from r.other_worker_id then raise exception 'Accord du collègue et versions inchangées requis';end if;
 -- Temporarily unassign inside this transaction; each final assignment rechecks overlap,
 -- leave and availability. Either both final assignments succeed, or neither changes.
 update public.scheduled_shifts set worker_id=null,user_id=null where id in (s.id,t.id);
 update public.scheduled_shifts set worker_id=r.other_worker_id,user_id=null,version=version+1 where id=s.id;
 update public.scheduled_shifts set worker_id=r.worker_id,user_id=null,version=version+1 where id=t.id;
 end if;
 end if;
 update public.essential_shift_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(r.company_id,auth.uid(),'shift_change_review',r.id,jsonb_build_object('request',to_jsonb(r),'source',to_jsonb(s),'other',to_jsonb(t)),jsonb_build_object('approved',p_approve),trim(p_note));
 for v_recipient in select distinct auth_user_id from public.company_workers where id in (r.worker_id,r.other_worker_id) and auth_user_id is not null loop
 insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(r.company_id,v_recipient,'shift_request','Demande de quart traitée',case when p_approve then 'Approuvée : ' else 'Refusée : ' end||trim(p_note));end loop;
end $$;
create function public.cancel_essential_shift_request(p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.essential_shift_requests;
begin
 select * into r from public.essential_shift_requests where id=p_request for update;
 if not found or r.status not in ('pending','accepted') or not private.is_member(r.company_id) or not exists(select 1 from public.company_workers where id=r.worker_id and auth_user_id=auth.uid() and status='active') then raise exception using errcode='42501',message='Demande personnelle requise';end if;
 update public.essential_shift_requests set status='cancelled' where id=r.id;
end $$;
-- A colleague's shift is disclosed only as a safe, optional exchange proposal.
create function public.essential_swap_options(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'shift_swaps') then raise exception using errcode='42501',message='Échanges non autorisés';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'location_id',s.location_id,'department_id',s.department_id,'name',w.first_name||' '||w.last_name)) from public.scheduled_shifts s join public.company_workers w on w.id=s.worker_id where s.company_id=p_company and s.cancelled_at is null and s.starts_at>clock_timestamp() and w.status='active' and w.auth_user_id is not null and w.auth_user_id<>auth.uid() and exists(select 1 from public.company_workers me where me.company_id=p_company and me.auth_user_id=auth.uid() and me.status='active' and me.personal_access and me.location_id=s.location_id and me.department_id is not distinct from s.department_id) and s.starts_at<clock_timestamp()+interval '90 days'),'[]'::jsonb);
end $$;
create function public.rotate_essential_shifts(p_company uuid,p_worker uuid,p_location uuid,p_department uuid,p_first date,p_cycle_days integer,p_cycles integer,p_pattern jsonb,p_request uuid) returns uuid[] language plpgsql security definer set search_path='' as $$
declare l public.essential_locations;v_config jsonb;v_previous private.essential_schedule_batches;v_ids uuid[]:='{}';v_item jsonb;v_cycle integer;v_day date;v_start time;v_end time;v_id uuid;
begin
 if not private.essential_can_plan(p_company,p_department) or not private.essential_feature(p_company,'advanced_schedules') then raise exception using errcode='42501',message='Rotation non autorisée';end if;
 if p_first is null or p_request is null or p_cycle_days is null or p_cycle_days not between 1 and 28 or p_cycles is null or p_cycles<1 or p_cycle_days*p_cycles>366 or p_pattern is null or jsonb_typeof(p_pattern)<>'array' or jsonb_array_length(p_pattern) not between 1 and 28 then raise exception 'Cycle invalide (maximum 366 jours)';end if;
 select * into l from public.essential_locations where company_id=p_company and id=p_location and active;if not found then raise exception 'Établissement invalide';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:'||p_company::text||p_request::text,0));
 v_config:=jsonb_build_object('rotation',true,'worker',p_worker,'location',p_location,'department',p_department,'first',p_first,'days',p_cycle_days,'cycles',p_cycles,'pattern',p_pattern);
 select * into v_previous from private.essential_schedule_batches where company_id=p_company and request_id=p_request;
 if found then if v_previous.configuration<>v_config then raise exception 'Identifiant réutilisé avec un autre cycle';end if;return v_previous.shift_ids;end if;
 for v_cycle in 0..p_cycles-1 loop
 for v_item in select value from jsonb_array_elements(p_pattern) loop
 if jsonb_typeof(v_item)<>'object' or (v_item->>'day') is null or (v_item->>'day')::integer not between 0 and p_cycle_days-1 or v_item->>'start' is null or v_item->>'end' is null then raise exception 'Jour de rotation invalide';end if;
 v_day:=p_first+v_cycle*p_cycle_days+(v_item->>'day')::integer;v_start:=(v_item->>'start')::time;v_end:=(v_item->>'end')::time;
 if v_start=v_end then raise exception 'Début et fin identiques';end if;
 v_id:=public.save_essential_shift(p_company,p_worker,p_location,p_department,private.essential_local_instant(v_day+v_start,l.timezone),private.essential_local_instant((v_day+case when v_end<v_start then 1 else 0 end)+v_end,l.timezone),'Rotation d’équipe');
 update public.scheduled_shifts set recurring_batch=p_request where id=v_id;v_ids:=array_append(v_ids,v_id);
 end loop;end loop;
 insert into private.essential_schedule_batches values(p_company,p_request,v_config,v_ids);return v_ids;
end $$;
alter table public.essential_departments add column minimum_staff integer not null default 0 check(minimum_staff between 0 and 1000);
create function public.set_essential_minimum_staff(p_department uuid,p_minimum integer) returns void language plpgsql security definer set search_path='' as $$
declare d public.essential_departments;
begin
 select * into d from public.essential_departments where id=p_department;
 if not found or not private.can_administer(d.company_id) or not private.essential_feature(d.company_id,'minimum_coverage') then raise exception using errcode='42501',message='Couverture minimale : responsable Pro requis';end if;
 update public.essential_departments set minimum_staff=p_minimum where id=d.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(d.company_id,auth.uid(),'minimum_staff',d.id,jsonb_build_object('minimum',p_minimum),'Minimum de couverture du département');
end $$;
create function public.essential_planning_report(p_company uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_coverage jsonb;
begin
 if not private.is_manager(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '31 days' then raise exception 'Période maximale : 31 jours';end if;
 if private.essential_feature(p_company,'minimum_coverage') then
 with boundaries as (
 select p_start t union select p_end union select greatest(p_start,starts_at) from public.scheduled_shifts where company_id=p_company and cancelled_at is null and starts_at<p_end and ends_at>p_start
 union select least(p_end,ends_at) from public.scheduled_shifts where company_id=p_company and cancelled_at is null and starts_at<p_end and ends_at>p_start
 ),windows as(select t a,lead(t) over(order by t) b from boundaries),gaps as(
 select d.id department_id,d.name,w.a starts_at,w.b ends_at,d.minimum_staff,
 (select count(distinct s.worker_id) from public.scheduled_shifts s where s.company_id=p_company and s.department_id=d.id and s.cancelled_at is null and s.worker_id is not null and s.starts_at<=w.a and s.ends_at>=w.b) staffed
 from public.essential_departments d cross join windows w where d.company_id=p_company and d.active and d.minimum_staff>0 and w.b>w.a
 ) select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into v_coverage from (select * from gaps where staffed<minimum_staff order by starts_at,department_id limit 2000) g;
 end if;
 return jsonb_build_object('planned_gross_ms',coalesce((select sum(extract(epoch from least(ends_at,p_end)-greatest(starts_at,p_start))*1000) from public.scheduled_shifts where company_id=p_company and worker_id is not null and cancelled_at is null and starts_at<p_end and ends_at>p_start),0),
 'actual_gross_ms',coalesce((select sum(extract(epoch from least(coalesce(ended_at,clock_timestamp()),p_end)-greatest(started_at,p_start))*1000) from public.punch_sessions where company_id=p_company and started_at<p_end and coalesce(ended_at,clock_timestamp())>p_start),0),
 'vacant_shifts',(select count(*) from public.scheduled_shifts where company_id=p_company and worker_id is null and cancelled_at is null and starts_at<p_end and ends_at>p_start),'coverage_gaps',v_coverage,'coverage_included',v_coverage is not null,'coverage_limit',2000);
end $$;
revoke all on function public.request_essential_shift_change(uuid,text,uuid),public.answer_essential_swap(uuid,boolean),public.review_essential_shift_request(uuid,boolean,text),public.cancel_essential_shift_request(uuid),public.essential_swap_options(uuid),public.rotate_essential_shifts(uuid,uuid,uuid,uuid,date,integer,integer,jsonb,uuid),public.set_essential_minimum_staff(uuid,integer),public.essential_planning_report(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.request_essential_shift_change(uuid,text,uuid),public.answer_essential_swap(uuid,boolean),public.review_essential_shift_request(uuid,boolean,text),public.cancel_essential_shift_request(uuid),public.essential_swap_options(uuid),public.rotate_essential_shifts(uuid,uuid,uuid,uuid,date,integer,integer,jsonb,uuid),public.set_essential_minimum_staff(uuid,integer),public.essential_planning_report(uuid,timestamptz,timestamptz) to authenticated;

create function public.create_essential_kiosk_pairing(p_company uuid,p_location uuid,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_location public.essential_locations;v_id uuid;v_token text;v_limit integer;
begin
 if not private.can_administer(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 perform 1 from public.companies where id=p_company for update;
 select * into v_location from public.essential_locations where company_id=p_company and id=p_location and active;
 if not found then raise exception 'Établissement invalide';end if;
 v_limit:=(private.essential_entitlement(p_company)->>'kiosk_limit')::integer;
 if v_limit is not null and (select count(*) from private.kiosk_devices where company_id=p_company and revoked_at is null and (paired_at is not null or pair_expires_at>clock_timestamp()))>=v_limit then raise exception 'Limite de bornes atteinte';end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.kiosk_devices(company_id,site_id,name,pair_hash,pair_expires_at,created_by) values(p_company,v_location.punch_job_id,trim(p_name),sha256(convert_to(v_token,'UTF8')),clock_timestamp()+interval '10 minutes',auth.uid()) returning id into v_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,after_value,reason) values(p_company,auth.uid(),'kiosk_pairing',v_id,jsonb_build_object('location',p_location),'Appairage temporaire demandé');
 return jsonb_build_object('device_id',v_id,'pairing_code',v_id::text||'.'||v_token,'expires_in_minutes',10);
end $$;
create or replace function public.create_kiosk_pairing(p_company uuid,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_location uuid;
begin
 select l.id into v_location from public.essential_locations l join public.companies c on c.id=l.company_id and c.default_punch_job_id=l.punch_job_id where l.company_id=p_company;
 return public.create_essential_kiosk_pairing(p_company,v_location,p_name);
end $$;
revoke all on function public.create_essential_kiosk_pairing(uuid,uuid,text) from public,anon;
grant execute on function public.create_essential_kiosk_pairing(uuid,uuid,text) to authenticated;
