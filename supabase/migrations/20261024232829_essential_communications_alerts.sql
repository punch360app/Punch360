create table public.essential_announcements (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),department_id uuid,
 title text not null check(length(trim(title)) between 2 and 140),body text not null check(length(trim(body)) between 1 and 5000),urgent boolean not null default false,
 created_by uuid not null,created_at timestamptz not null default now(),expires_at timestamptz,withdrawn_at timestamptz,
 foreign key(company_id,department_id) references public.essential_departments(company_id,id),check(expires_at is null or expires_at>created_at)
);
create index announcements_company on public.essential_announcements(company_id,created_at desc);
alter table public.essential_announcements enable row level security;
create function private.essential_announcement_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.essential_announcements a where a.id=p_id and private.is_member(a.company_id) and (private.is_manager(a.company_id) or (a.withdrawn_at is null and (a.expires_at is null or a.expires_at>now()) and exists(select 1 from public.company_workers w where w.company_id=a.company_id and w.auth_user_id=auth.uid() and w.status='active' and w.personal_access and (a.department_id is null or a.department_id=w.department_id)))))
$$;
revoke all on function private.essential_announcement_visible(uuid) from public,anon;
grant execute on function private.essential_announcement_visible(uuid) to authenticated;
create policy announcement_read on public.essential_announcements for select to authenticated using(private.essential_announcement_visible(id));
grant select on public.essential_announcements to authenticated;
revoke insert,update,delete on public.essential_announcements from anon,authenticated;
create table public.essential_announcement_receipts (
 announcement_id uuid not null references public.essential_announcements(id),user_id uuid not null references auth.users(id),read_at timestamptz not null default now(),primary key(announcement_id,user_id)
);
alter table public.essential_announcement_receipts enable row level security;
create policy announcement_receipts_read on public.essential_announcement_receipts for select to authenticated using((user_id=(select auth.uid()) and private.essential_announcement_visible(announcement_id)) or exists(select 1 from public.essential_announcements a where a.id=announcement_id and private.is_manager(a.company_id)));
grant select on public.essential_announcement_receipts to authenticated;
revoke insert,update,delete on public.essential_announcement_receipts from anon,authenticated;
create function public.publish_essential_announcement(p_company uuid,p_department uuid,p_title text,p_body text,p_urgent boolean default false,p_expires timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.can_administer(p_company) or not private.essential_feature(p_company,'announcements') then raise exception using errcode='42501',message='Gestionnaire autorisé et forfait Plus ou Pro requis';end if;
 if (select count(*) from public.essential_announcements where company_id=p_company and created_at>now()-interval '1 day')>=50 then raise exception 'Limite de 50 annonces par jour atteinte';end if;
 insert into public.essential_announcements(company_id,department_id,title,body,urgent,expires_at,created_by) values(p_company,p_department,trim(p_title),trim(p_body),p_urgent,p_expires,auth.uid()) returning id into result;
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select p_company,w.auth_user_id,'announcement',case when p_urgent then 'IMPORTANT · ' else '' end||trim(p_title),'Une annonce autorisée est disponible dans Communications.' from public.company_workers w join public.company_members m on m.company_id=w.company_id and m.user_id=w.auth_user_id where w.company_id=p_company and w.status='active' and w.personal_access and m.status='active' and (p_department is null or w.department_id=p_department);
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(p_company,auth.uid(),'announcement_published',result,'Annonce publiée');return result;
end $$;
create function public.acknowledge_essential_announcement(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.essential_announcement_visible(p_id) or not exists(select 1 from public.essential_announcements where id=p_id and withdrawn_at is null and (expires_at is null or expires_at>now())) then raise exception using errcode='42501',message='Annonce inaccessible';end if;
 insert into public.essential_announcement_receipts(announcement_id,user_id) values(p_id,auth.uid()) on conflict do nothing;
end $$;
create function public.withdraw_essential_announcement(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 select company_id into c from public.essential_announcements where id=p_id for update;
 if c is null or not private.can_administer(c) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Motif requis';end if;
 update public.essential_announcements set withdrawn_at=clock_timestamp() where id=p_id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,reason) values(c,auth.uid(),'announcement_withdrawn',p_id,trim(p_reason));
end $$;
create table public.essential_shift_notes (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),worker_id uuid not null,department_id uuid,author_id uuid not null,
 body text not null check(length(trim(body)) between 1 and 3000),created_at timestamptz not null default now(),
 foreign key(company_id,worker_id) references public.company_workers(company_id,id),foreign key(company_id,department_id) references public.essential_departments(company_id,id)
);
create index shift_notes_company on public.essential_shift_notes(company_id,department_id,created_at desc);
alter table public.essential_shift_notes enable row level security;
create policy shift_notes_read on public.essential_shift_notes for select to authenticated using(private.is_member(company_id) and (author_id=(select auth.uid()) or private.is_manager(company_id) or private.essential_can_plan(company_id,department_id)));
grant select on public.essential_shift_notes to authenticated;
revoke insert,update,delete on public.essential_shift_notes from anon,authenticated;
create function public.add_essential_shift_note(p_company uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.company_workers;result uuid;
begin
 if not private.is_member(p_company) or not private.essential_feature(p_company,'hr_documents') then raise exception using errcode='42501',message='Forfait Pro requis';end if;
 select * into w from public.company_workers where company_id=p_company and auth_user_id=auth.uid() and status='active' and personal_access;
 if not found then raise exception 'Dossier salarié requis';end if;
 insert into public.essential_shift_notes(company_id,worker_id,department_id,author_id,body) values(p_company,w.id,w.department_id,auth.uid(),trim(p_body)) returning id into result;return result;
end $$;
-- Deduplicated internal alerts; never stores provider secrets or sends SMS.
create table private.essential_notice_keys (
 company_id uuid not null,kind text not null,entity_key text not null,recipient_id uuid not null,created_at timestamptz not null default now(),primary key(company_id,kind,entity_key,recipient_id)
);
alter table private.essential_notice_keys enable row level security;
revoke all on private.essential_notice_keys from public,anon,authenticated;
create function private.essential_internal_notice(p_company uuid,p_kind text,p_entity text,p_recipient uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.essential_notice_keys(company_id,kind,entity_key,recipient_id) values(p_company,p_kind,p_entity,p_recipient) on conflict do nothing;
 if found then insert into public.app_notifications(company_id,recipient_id,kind,title,body) values(p_company,p_recipient,p_kind,p_title,p_body);end if;
end $$;
revoke all on function private.essential_internal_notice(uuid,text,text,uuid,text,text) from public,anon,authenticated;
create function private.essential_daily_alerts() returns void language plpgsql security definer set search_path='' as $$
declare r record;m record;k text;
begin
 for r in select c.*,w.auth_user_id,w.personal_access,(clock_timestamp() at time zone coalesce(l.timezone,'America/Toronto'))::date as local_today from public.essential_certifications c join public.company_workers w on w.id=c.worker_id and w.company_id=c.company_id left join public.essential_locations l on l.id=w.location_id and l.company_id=w.company_id where w.status='active' and c.expires_on<=(clock_timestamp() at time zone coalesce(l.timezone,'America/Toronto'))::date+30 and private.essential_feature(c.company_id,'certifications') loop
 k:=r.id::text||':'||r.version::text||case when r.expires_on<r.local_today then ':expired' else ':soon' end;
 for m in select user_id from public.company_members cm where cm.company_id=r.company_id and cm.status='active' and (cm.role='boss' or (cm.role='admin' and exists(select 1 from public.essential_hr_grants g where g.company_id=cm.company_id and g.user_id=cm.user_id and g.certifications)) or (cm.user_id=r.auth_user_id and r.personal_access)) loop
 perform private.essential_internal_notice(r.company_id,'certification_expiry',k,m.user_id,case when r.expires_on<r.local_today then 'Certification expirée' else 'Certification à renouveler' end,r.title||' · échéance '||r.expires_on::text);
 end loop;end loop;
 for r in select s.id,s.company_id from public.punch_sessions s join public.companies c on c.id=s.company_id where c.product_edition='essential' and s.ended_at is null and s.started_at<now()-interval '16 hours' loop
 for m in select user_id from public.company_members where company_id=r.company_id and status='active' and role in ('boss','admin') loop
 perform private.essential_internal_notice(r.company_id,'forgotten_out',r.id::text,m.user_id,'Sortie à vérifier','Une session dépasse 16 heures. Vérifiez la situation avant toute correction.');end loop;end loop;
end $$;
revoke all on function private.essential_daily_alerts() from public,anon,authenticated;
-- The scheduler calls only this closed server function; no HTTP or paid provider.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('punch-essential-daily-alerts','10 * * * *','select private.essential_daily_alerts()');
revoke all on function public.publish_essential_announcement(uuid,uuid,text,text,boolean,timestamptz),public.acknowledge_essential_announcement(uuid),public.withdraw_essential_announcement(uuid,text),public.add_essential_shift_note(uuid,text) from public,anon;
grant execute on function public.publish_essential_announcement(uuid,uuid,text,text,boolean,timestamptz),public.acknowledge_essential_announcement(uuid),public.withdraw_essential_announcement(uuid,text),public.add_essential_shift_note(uuid,text) to authenticated;
