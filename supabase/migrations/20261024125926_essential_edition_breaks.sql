alter table public.companies add column product_edition text not null default 'construction' check(product_edition in ('construction','essential'));
alter table public.companies add column default_punch_job_id uuid;
alter table public.companies add foreign key(id,default_punch_job_id) references public.jobs(company_id,id);
create function public.create_company_for_edition(p_name text,p_edition text default 'construction')
returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid; j uuid;
begin
 if auth.uid() is null or p_edition not in ('construction','essential') then raise exception 'Édition invalide'; end if;
 c:=public.create_my_company(p_name);
 if p_edition='essential' then
  insert into public.jobs(company_id,number,name) values(c,'ESSENTIEL','Établissement') returning id into j;
  update public.companies set product_edition='essential',default_punch_job_id=j where id=c;
 end if;
 return c;
end $$;
create function private.has_construction(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member(p_company) and exists(select 1 from public.companies where id=p_company and product_edition='construction')
$$;
revoke all on function public.create_company_for_edition(text,text),private.has_construction(uuid) from public,anon;
grant execute on function public.create_company_for_edition(text,text),private.has_construction(uuid) to authenticated;
drop policy orders_add on public.material_orders;
create policy orders_add on public.material_orders for insert to authenticated with check(created_by=auth.uid() and status='requested' and private.has_construction(company_id));
drop policy docs_add on public.job_documents;
create policy docs_add on public.job_documents for insert to authenticated with check(private.can_administer(company_id) and private.has_construction(company_id) and created_by=auth.uid());
-- A site's technical identifier is kept internally so both editions share the same audited time ledger.
-- Essential never exposes job numbers, job selection or orders to users.
create table public.punch_breaks (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,session_id uuid not null,user_id uuid not null,
 started_at timestamptz not null,ended_at timestamptz,closed_by_punch_out boolean not null default false,
 check(ended_at is null or ended_at>=started_at),foreign key(company_id,session_id) references public.punch_sessions(company_id,id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create unique index one_open_break on public.punch_breaks(session_id) where ended_at is null;
create index breaks_company_session on public.punch_breaks(company_id,session_id);
alter table public.punch_breaks enable row level security;
create policy breaks_read on public.punch_breaks for select to authenticated using(private.is_member(company_id) and (user_id=auth.uid() or private.is_manager(company_id) or private.lead_sees_session(session_id)));
grant select on public.punch_breaks to authenticated;
create function private.close_and_validate_breaks()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ended_at is not null then update public.punch_breaks set ended_at=new.ended_at,closed_by_punch_out=true
 where session_id=new.id and (ended_at is null or closed_by_punch_out); end if;
 if exists(select 1 from public.punch_breaks where session_id=new.id and (started_at<new.started_at or started_at>new.ended_at or ended_at>new.ended_at)) then raise exception 'Heures incompatibles avec les pauses enregistrées'; end if;
 return new;
end $$;
revoke all on function private.close_and_validate_breaks() from public,anon,authenticated;
create trigger close_and_validate_breaks before update of started_at,ended_at on public.punch_sessions for each row execute function private.close_and_validate_breaks();
create function public.sync_break_event(p_event uuid,p_company uuid,p_action text,p_occurred_at timestamptz,p_offline boolean,p_previous uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.punch_sessions; prior public.punch_event_receipts; existing public.punch_event_receipts; payload jsonb; result jsonb; t timestamptz; b uuid; err text;
begin
 if not private.is_member(p_company) then raise exception 'Accès refusé'; end if;
 if p_event is null or p_action not in ('break_start','break_end') or p_action is null or p_offline is null or p_occurred_at is null then raise exception 'Pause invalide'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text,0));
 payload:=jsonb_build_object('action',p_action,'occurred_at',p_occurred_at,'previous',p_previous);
 select * into existing from public.punch_event_receipts where company_id=p_company and user_id=auth.uid() and event_id=p_event;
 if found then if existing.payload<>payload then raise exception 'Identifiant réutilisé';end if;return existing.result;end if;
 begin
  select * into s from public.punch_sessions where company_id=p_company and user_id=auth.uid() and ended_at is null for update;
  if not found then raise exception 'Aucun punch actif'; end if;
  if p_previous is not null then
   select * into prior from public.punch_event_receipts where company_id=p_company and user_id=auth.uid() and event_id=p_previous;
   if not found or prior.result->>'sync_status'='conflict' or (prior.result->>'session_id' is not null and (prior.result->>'session_id')::uuid<>s.id) then raise exception 'Événement précédent à vérifier'; end if;
  end if;
  t:=case when p_offline then p_occurred_at else clock_timestamp() end;
  if t<s.started_at or t>clock_timestamp()+interval '5 minutes' or t<clock_timestamp()-interval '30 days' then raise exception 'Heure de pause à vérifier'; end if;
  perform private.assert_open_period(p_company,s.started_at,t+interval '1 microsecond');
  if p_action='break_start' then
   if exists(select 1 from public.punch_breaks where session_id=s.id and (ended_at is null or ended_at>t)) then raise exception 'Pause en conflit'; end if;
   insert into public.punch_breaks(company_id,session_id,user_id,started_at) values(p_company,s.id,auth.uid(),t) returning id into b;
  else
   update public.punch_breaks set ended_at=t where session_id=s.id and ended_at is null and started_at<t returning id into b;
   if b is null then raise exception 'Aucune pause active ou heure invalide'; end if;
  end if;
  result:=jsonb_build_object('sync_status','synced','session_id',s.id,'break_id',b,'review_status',case when p_offline then 'pending' else 'automatic' end);
 exception when others then get stacked diagnostics err=message_text;result:=jsonb_build_object('sync_status','conflict','message',err);end;
 insert into public.punch_event_receipts(company_id,user_id,event_id,action,occurred_at,offline,payload,result)
 values(p_company,auth.uid(),p_event,p_action,p_occurred_at,p_offline,payload,result);
 if p_offline or result->>'sync_status'='conflict' then insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select p_company,user_id,'break_event','Pause à vérifier',p_action||' · '||p_occurred_at::text||coalesce(' · '||(result->>'message'),'') from public.company_members where company_id=p_company and role in ('boss','admin') and status='active';end if;
 return result;
end $$;
create function public.review_break_event(p_company uuid,p_worker uuid,p_event uuid,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.punch_event_receipts;
begin
 if not private.can_administer(p_company) or p_worker=auth.uid() then raise exception 'Accès refusé'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'Motif requis'; end if;
 select * into r from public.punch_event_receipts where company_id=p_company and user_id=p_worker and event_id=p_event for update;
 if not found or r.action not in ('break_start','break_end') or r.result->>'review_status'<>'pending' or r.result->>'sync_status'<>'synced' then raise exception 'Pause non admissible'; end if;
 update public.punch_event_receipts set result=result||jsonb_build_object('review_status','accepted') where company_id=p_company and user_id=p_worker and event_id=p_event;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason) values(p_company,auth.uid(),'break_review',p_event,to_jsonb(r),trim(p_note));
end $$;
revoke all on function public.sync_break_event(uuid,uuid,text,timestamptz,boolean,uuid),public.review_break_event(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.sync_break_event(uuid,uuid,text,timestamptz,boolean,uuid),public.review_break_event(uuid,uuid,uuid,text) to authenticated;
create or replace function private.check_payroll_location_reviews()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reopened_at is null then
  if exists(select 1 from public.punch_location_checks c join public.punch_sessions s on s.id=c.session_id
   where c.company_id=new.company_id and c.review_status='pending' and s.started_at<((new.week_start+7)::timestamp at time zone 'America/Toronto')
   and coalesce(s.ended_at,'infinity'::timestamptz)>(new.week_start::timestamp at time zone 'America/Toronto')) then raise exception 'Punchs GPS/hors ligne à valider avant fermeture';end if;
  if exists(select 1 from public.punch_event_receipts r join public.punch_sessions s on s.id=(r.result->>'session_id')::uuid
   where r.company_id=new.company_id and r.action in ('break_start','break_end') and r.result->>'review_status'='pending'
   and s.started_at<((new.week_start+7)::timestamp at time zone 'America/Toronto') and s.ended_at>(new.week_start::timestamp at time zone 'America/Toronto')) then raise exception 'Pauses hors ligne à valider avant fermeture';end if;
 end if;return new;
end $$;
