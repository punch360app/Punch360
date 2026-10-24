-- PUNCH 360° : équipes et messagerie. Aucun droit global de lecture pour Admin/Boss sur groupes privés.
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 140),
 lead_user_id uuid not null,
 created_at timestamptz not null default now(),
 unique(company_id,id),
 foreign key(company_id,lead_user_id) references public.company_members(company_id,user_id)
);
create table public.team_members (
 company_id uuid not null,
 team_id uuid not null,
 user_id uuid not null,
 joined_at timestamptz not null default now(),
 primary key(company_id,team_id,user_id),
 foreign key(company_id,team_id) references public.teams(company_id,id) on delete cascade,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 kind text not null check(kind in ('team_private','group','direct')),
 title text not null default '',
 team_id uuid,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 unique(company_id,id),
 foreign key(company_id,team_id) references public.teams(company_id,id),
 foreign key(company_id,created_by) references public.company_members(company_id,user_id),
 check((kind='team_private')=(team_id is not null))
);
create unique index one_private_conversation_per_team on public.conversations(team_id) where kind='team_private';
create table public.conversation_members (
 company_id uuid not null,
 conversation_id uuid not null,
 user_id uuid not null,
 joined_at timestamptz not null default now(),
 primary key(company_id,conversation_id,user_id),
 foreign key(company_id,conversation_id) references public.conversations(company_id,id) on delete cascade,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create table public.conversation_messages (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 conversation_id uuid not null,
 sender_id uuid not null,
 body text not null check (length(trim(body)) between 1 and 6000),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(company_id,conversation_id) references public.conversations(company_id,id) on delete cascade,
 foreign key(company_id,sender_id) references public.company_members(company_id,user_id)
);
create index messages_conversation_order on public.conversation_messages(conversation_id,created_at desc);

create function private.is_chat_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.conversation_members cm
  join public.conversations c on c.company_id=cm.company_id and c.id=cm.conversation_id
  join public.company_members m on m.company_id=cm.company_id and m.user_id=cm.user_id
  where cm.conversation_id=p_conversation and cm.user_id=(select auth.uid()) and m.status='active'
    and (c.kind<>'team_private' or m.role in ('employee','lead'))
 ) $$;
revoke all on function private.is_chat_member(uuid) from public,anon;
grant execute on function private.is_chat_member(uuid) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_messages enable row level security;
create policy team_read on public.teams for select to authenticated
 using(private.is_manager(company_id) or lead_user_id=(select auth.uid()) or exists(
 select 1 from public.team_members tm where tm.team_id=id and tm.user_id=(select auth.uid())));
create policy team_members_read on public.team_members for select to authenticated
 using(user_id=(select auth.uid()) or private.is_manager(company_id) or exists(
 select 1 from public.teams t where t.id=team_id and t.lead_user_id=(select auth.uid())));
create policy chat_read on public.conversations for select to authenticated using(private.is_chat_member(id));
create policy chat_members_read on public.conversation_members for select to authenticated using(private.is_chat_member(conversation_id));
create policy chat_messages_read on public.conversation_messages for select to authenticated using(private.is_chat_member(conversation_id));
create policy chat_messages_write on public.conversation_messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and private.is_chat_member(conversation_id));
grant select on public.teams,public.team_members,public.conversations,public.conversation_members,public.conversation_messages to authenticated;
grant insert(company_id,conversation_id,sender_id,body) on public.conversation_messages to authenticated;

-- Create teams (only admin/boss), then add employees. No generic write access to memberships.
create function public.create_team(p_company uuid,p_name text,p_lead uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;v_role text;
begin
 if not private.is_manager(p_company) then raise exception 'Manager role required';end if;
 select role into v_role from public.company_members where company_id=p_company and user_id=p_lead and status='active';
 if v_role<>'lead' then raise exception 'Leader must have a lead role';end if;
 if length(trim(coalesce(p_name,'')))<1 then raise exception 'Name required';end if;
 insert into public.teams(company_id,name,lead_user_id) values(p_company,trim(p_name),p_lead) returning id into v_id;
 insert into public.team_members(company_id,team_id,user_id) values(p_company,v_id,p_lead);
 return v_id;
end $$;
create function public.add_team_employee(p_team uuid,p_employee uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid;v_role text;
begin
 select company_id into v_company from public.teams where id=p_team;
 if v_company is null or not private.is_manager(v_company) then raise exception 'Manager role required';end if;
 select role into v_role from public.company_members where company_id=v_company and user_id=p_employee and status='active';
 if v_role not in ('lead','employee') then raise exception 'Employee or lead role required';end if;
 insert into public.team_members(company_id,team_id,user_id) values(v_company,p_team,p_employee) on conflict do nothing;
 insert into public.conversation_members(company_id,conversation_id,user_id)
 select v_company,c.id,p_employee from public.conversations c where c.team_id=p_team and c.kind='team_private'
 on conflict do nothing;
end $$;
create function public.create_private_team_chat(p_team uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_company uuid;v_lead uuid;v_name text;v_conv uuid;
begin
 select company_id,lead_user_id,name into v_company,v_lead,v_name from public.teams where id=p_team;
 if v_lead is null or v_lead is distinct from (select auth.uid()) then raise exception 'Only this team leader can create its private chat';end if;
 if not private.is_member(v_company) then raise exception 'Active company membership required';end if;
 select id into v_conv from public.conversations where team_id=p_team and kind='team_private';
 if v_conv is not null then return v_conv;end if;
 insert into public.conversations(company_id,kind,title,team_id,created_by)
 values(v_company,'team_private',v_name,p_team,v_lead) returning id into v_conv;
 insert into public.conversation_members(company_id,conversation_id,user_id)
 select tm.company_id,v_conv,tm.user_id from public.team_members tm
 join public.company_members m on m.company_id=tm.company_id and m.user_id=tm.user_id
 where tm.team_id=p_team and m.status='active' and m.role in ('lead','employee');
 return v_conv;
end $$;
create function public.create_company_group(p_company uuid,p_title text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_conv uuid;v_uid uuid:=auth.uid();v_member uuid;
begin
 if not private.is_manager(p_company) then raise exception 'Manager role required';end if;
 if length(trim(coalesce(p_title,'')))<1 or length(trim(p_title))>140 then raise exception 'Invalid group title';end if;
 if coalesce(array_length(p_member_ids,1),0)>200 then raise exception 'Group too large';end if;
 if exists(select 1 from unnest(coalesce(p_member_ids,array[]::uuid[])) u
 where not exists(select 1 from public.company_members m where m.company_id=p_company and m.user_id=u and m.status='active'))
 then raise exception 'All members must belong to the company';end if;
 insert into public.conversations(company_id,kind,title,created_by)
 values(p_company,'group',trim(p_title),v_uid) returning id into v_conv;
 insert into public.conversation_members(company_id,conversation_id,user_id) values(p_company,v_conv,v_uid);
 insert into public.conversation_members(company_id,conversation_id,user_id)
 select p_company,v_conv,u from unnest(coalesce(p_member_ids,array[]::uuid[])) u on conflict do nothing;
 return v_conv;
end $$;
create function public.add_group_member(p_conversation uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_company uuid;v_kind text;
begin
 select company_id,kind into v_company,v_kind from public.conversations where id=p_conversation;
 if v_company is null or v_kind<>'group' or not private.is_manager(v_company) then raise exception 'Group manager required';end if;
 if not exists(select 1 from public.company_members where company_id=v_company and user_id=p_user and status='active') then raise exception 'Not a member';end if;
 insert into public.conversation_members(company_id,conversation_id,user_id) values(v_company,p_conversation,p_user) on conflict do nothing;
end $$;

-- Remove private-chat access when a worker leaves an actual team.
create function private.revoke_private_chat_when_leaving()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 delete from public.conversation_members cm
 using public.conversations c where cm.conversation_id=c.id
 and cm.company_id=old.company_id and cm.user_id=old.user_id
 and c.kind='team_private' and c.team_id=old.team_id;
 return old;
end $$;
create trigger revoke_team_chat_after_remove after delete on public.team_members
for each row execute function private.revoke_private_chat_when_leaving();

revoke all on function public.create_team(uuid,text,uuid),public.add_team_employee(uuid,uuid),
 public.create_private_team_chat(uuid),public.create_company_group(uuid,text,uuid[]),
 public.add_group_member(uuid,uuid) from public,anon;
grant execute on function public.create_team(uuid,text,uuid),public.add_team_employee(uuid,uuid),
 public.create_private_team_chat(uuid),public.create_company_group(uuid,text,uuid[]),
 public.add_group_member(uuid,uuid) to authenticated;
