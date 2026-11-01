-- Cross-device read cursors for shared Construction and Essentiel Plus/Pro chats.
-- Conversation entitlement and participant checks remain server-side.
create table public.chat_read_cursors (
 company_id uuid not null,
 conversation_id uuid not null,
 user_id uuid not null,
 last_read_at timestamptz not null,
 last_read_message_id uuid not null,
 primary key(company_id,conversation_id,user_id),
 foreign key(company_id,conversation_id) references public.conversations(company_id,id) on delete cascade,
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
alter table public.chat_read_cursors enable row level security;
revoke all on public.chat_read_cursors from public,anon,authenticated;

create function public.chat_unread_counts(p_company uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare summary jsonb;
begin
 if auth.uid() is null or not private.is_member(p_company) then
  raise exception using errcode='42501',message='Entreprise inaccessible';
 end if;
 if not private.company_chat_enabled(p_company) then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('conversation_id',c.id,'unread',least(msg.unread_count,99)::integer)),'[]'::jsonb)
 into summary
 from public.conversation_members cm
 join public.conversations c on c.id=cm.conversation_id and c.company_id=cm.company_id
 left join public.chat_read_cursors cursor on cursor.company_id=cm.company_id
  and cursor.conversation_id=cm.conversation_id and cursor.user_id=cm.user_id
 cross join lateral (
  select count(*) as unread_count from public.conversation_messages m
  where m.company_id=cm.company_id and m.conversation_id=cm.conversation_id
   and m.sender_id<>auth.uid()
   and (cursor.last_read_at is null or
        (m.created_at,m.id)>(cursor.last_read_at,cursor.last_read_message_id))
 ) msg
 where cm.company_id=p_company and cm.user_id=auth.uid()
  and private.is_chat_member(c.id);
 return summary;
end $$;

create function public.chat_mark_read(p_company uuid,p_conversation uuid,p_message uuid)
returns void language plpgsql security definer set search_path='' as $$
declare seen_at timestamptz;
begin
 if auth.uid() is null or p_message is null or
  not private.is_member(p_company) or not private.company_chat_enabled(p_company) or
  not exists(select 1 from public.conversations where id=p_conversation and company_id=p_company) or
  not private.is_chat_member(p_conversation) then
  raise exception using errcode='42501',message='Conversation inaccessible';
 end if;
 select created_at into seen_at from public.conversation_messages
 where id=p_message and conversation_id=p_conversation and company_id=p_company;
 if not found then raise exception using errcode='42501',message='Message inaccessible';end if;
 insert into public.chat_read_cursors(company_id,conversation_id,user_id,last_read_at,last_read_message_id)
 values(p_company,p_conversation,auth.uid(),seen_at,p_message)
 on conflict(company_id,conversation_id,user_id) do update
 set last_read_at=excluded.last_read_at,last_read_message_id=excluded.last_read_message_id
 where (excluded.last_read_at,excluded.last_read_message_id)>
       (public.chat_read_cursors.last_read_at,public.chat_read_cursors.last_read_message_id);
end $$;

revoke all on function public.chat_unread_counts(uuid),public.chat_mark_read(uuid,uuid,uuid) from public,anon;
grant execute on function public.chat_unread_counts(uuid),public.chat_mark_read(uuid,uuid,uuid) to authenticated;
