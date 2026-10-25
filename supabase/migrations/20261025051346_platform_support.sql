create table private.support_tickets (
 id uuid primary key,company_id uuid not null references public.companies(id),created_by uuid not null references auth.users(id),
 subject text not null check(length(subject) between 3 and 160),status text not null default 'open' check(status in('open','waiting','resolved','closed')),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table private.support_messages (
 id uuid primary key,ticket_id uuid not null references private.support_tickets(id),author_id uuid not null references auth.users(id),
 is_platform boolean not null,body text not null check(length(body) between 3 and 5000),created_at timestamptz not null default now()
);
alter table private.support_tickets enable row level security;
alter table private.support_messages enable row level security;
revoke all on private.support_tickets,private.support_messages from public,anon,authenticated;
create index support_company_updated on private.support_tickets(company_id,updated_at desc,id);
create index support_thread_created on private.support_messages(ticket_id,created_at,id);
create function private.assert_support_access(p_company uuid,p_creator uuid default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.platform_owner where user_id=auth.uid()) then perform private.assert_live_platform_session();return true;end if;
 if not private.is_member(p_company) or (p_creator is not null and p_creator<>auth.uid() and not private.is_manager(p_company)) then raise exception using errcode='42501',message='Accès au support refusé';end if;
 return false;
end $$;
revoke all on function private.assert_support_access(uuid,uuid) from public,anon,authenticated;
create function public.support_create_ticket(p_company uuid,p_subject text,p_body text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare existing private.support_tickets;
begin
 perform private.assert_support_access(p_company);
 if p_request is null or length(trim(coalesce(p_subject,''))) not between 3 and 160 or length(trim(coalesce(p_body,''))) not between 3 and 5000 then raise exception 'Objet et message requis';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 select * into existing from private.support_tickets where id=p_request;
 if found then
  if existing.company_id<>p_company or existing.created_by<>auth.uid() or existing.subject<>trim(p_subject) or not exists(select 1 from private.support_messages where id=p_request and ticket_id=p_request and body=trim(p_body)) then raise exception 'Identifiant de demande déjà utilisé';end if;
  return existing.id;
 end if;
 insert into private.support_tickets(id,company_id,created_by,subject) values(p_request,p_company,auth.uid(),trim(p_subject));
 insert into private.support_messages(id,ticket_id,author_id,is_platform,body) values(p_request,p_request,auth.uid(),exists(select 1 from private.platform_owner where user_id=auth.uid()),trim(p_body));
 return p_request;
end $$;
create function public.support_list_tickets(p_company uuid default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare platform boolean;
begin
 if p_company is null then perform private.assert_live_platform_session();platform:=true;else platform:=private.assert_support_access(p_company);end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id desc) from (
 select s.*,c.name as company_name from private.support_tickets s join public.companies c on c.id=s.company_id
 where (p_company is null or s.company_id=p_company) and (platform or s.created_by=auth.uid() or private.is_manager(s.company_id))
 and (p_before is null or (s.updated_at,s.id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by s.updated_at desc,s.id desc limit 50)t),'[]'::jsonb);
end $$;
create function public.support_ticket_detail(p_ticket uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t private.support_tickets;
begin
 select * into t from private.support_tickets where id=p_ticket;
 if not found then raise exception 'Demande inaccessible';end if;
 perform private.assert_support_access(t.company_id,t.created_by);
 return to_jsonb(t)||jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from (select id,is_platform,body,created_at from private.support_messages where ticket_id=t.id order by created_at desc,id desc limit 200)m),'[]'::jsonb));
end $$;
create function public.support_reply(p_ticket uuid,p_body text,p_request uuid,p_expected_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare t private.support_tickets;platform boolean;old private.support_messages;
begin
 select * into t from private.support_tickets where id=p_ticket for update;
 if not found then raise exception 'Demande inaccessible';end if;
 platform:=private.assert_support_access(t.company_id,t.created_by);
 if p_request is null or length(trim(coalesce(p_body,''))) not between 3 and 5000 then raise exception 'Message requis (3 à 5000 caractères)';end if;
 select * into old from private.support_messages where id=p_request;
 if found then
  if old.ticket_id<>p_ticket or old.author_id<>auth.uid() or old.body<>trim(p_body) then raise exception 'Identifiant de réponse déjà utilisé';end if;
  return t.version;
 end if;
 if p_expected_version is distinct from t.version then raise exception 'La demande a changé : actualiser avant de répondre';end if;
 if t.status='closed' then raise exception 'Réouvrir la demande avant de répondre';end if;
 insert into private.support_messages(id,ticket_id,author_id,is_platform,body) values(p_request,p_ticket,auth.uid(),platform,trim(p_body));
 update private.support_tickets set version=version+1,status=case when platform then 'waiting' else 'open' end,updated_at=clock_timestamp() where id=p_ticket returning version into t.version;
 if platform then insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'support_reply',p_ticket,'{}');end if;
 return t.version;
end $$;
create function public.support_set_status(p_ticket uuid,p_status text,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$
declare t private.support_tickets;platform boolean;
begin
 select * into t from private.support_tickets where id=p_ticket for update;
 if not found then raise exception 'Demande inaccessible';end if;
 platform:=private.assert_support_access(t.company_id,t.created_by);
 if p_status is null or p_status not in('open','waiting','resolved','closed') or (not platform and p_status='waiting') then raise exception 'Statut refusé';end if;
 if p_expected_version is distinct from t.version then raise exception 'La demande a changé : actualiser';end if;
 update private.support_tickets set status=p_status,version=version+1,updated_at=clock_timestamp() where id=p_ticket;
 if platform then insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'support_status',p_ticket,jsonb_build_object('before',t.status,'after',p_status));end if;
end $$;
revoke all on function public.support_create_ticket(uuid,text,text,uuid),public.support_list_tickets(uuid,timestamptz,uuid),public.support_ticket_detail(uuid),public.support_reply(uuid,text,uuid,integer),public.support_set_status(uuid,text,integer) from public,anon;
grant execute on function public.support_create_ticket(uuid,text,text,uuid),public.support_list_tickets(uuid,timestamptz,uuid),public.support_ticket_detail(uuid),public.support_reply(uuid,text,uuid,integer),public.support_set_status(uuid,text,integer) to authenticated;
