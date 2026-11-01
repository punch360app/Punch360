-- PUNCH Essentials: existing company chats are Plus / Pro only.
-- Preserve the Construction experience and existing chat participation RLS.
-- No data deletion: downgrades hide threads, later restoration reuses them.
create function private.company_chat_enabled(p_company uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.companies c where c.id=p_company
   and (c.product_edition='construction'
    or (c.product_edition='essential' and private.essential_feature(c.id,'messages')))
 )
$$;
revoke all on function private.company_chat_enabled(uuid) from public,anon,authenticated;

create function private.assert_company_chat_enabled(p_company uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.company_chat_enabled(p_company) then
  raise exception using errcode='42501',message='Messagerie réservée au forfait Essentiel Plus/Pro';
 end if;
end $$;
revoke all on function private.assert_company_chat_enabled(uuid) from public,anon,authenticated;

-- All conversations, participants, and messages already call is_chat_member in
-- their RLS predicates. Gate that single shared, already-protected source.
create or replace function private.is_chat_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.conversation_members cm
  join public.conversations c on c.company_id=cm.company_id and c.id=cm.conversation_id
  join public.company_members m on m.company_id=cm.company_id and m.user_id=cm.user_id
  where cm.conversation_id=p_conversation and cm.user_id=(select auth.uid()) and m.status='active'
    and private.company_chat_enabled(cm.company_id)
    and (c.kind<>'team_private' or m.role in ('employee','lead'))
 )
$$;

-- Preserve the current signatures, body and billing checks on the 3 historical
-- chat creation/membership RPCs (including later amendments). Add only a
-- precondition, not copies of their business logic.
do $$
declare f record; definition text; changed text; company_arg text; count_changed integer:=0;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (
   (p.proname='create_company_group' and pg_get_function_identity_arguments(p.oid) like 'p_company uuid,%')
   or (p.proname='create_private_team_chat' and pg_get_function_identity_arguments(p.oid)='p_team uuid')
   or (p.proname='add_group_member' and pg_get_function_identity_arguments(p.oid)='p_conversation uuid, p_user uuid')
  )
 loop
  definition:=pg_get_functiondef(f.oid);
  if position('private.assert_company_chat_enabled(' in definition)>0 then
   count_changed:=count_changed+1;continue;
  end if;
  company_arg:=case f.proname
   when 'create_company_group' then 'p_company'
   when 'create_private_team_chat' then '(select company_id from public.teams where id=p_team)'
   when 'add_group_member' then '(select company_id from public.conversations where id=p_conversation)'
  end;
  changed:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n perform private.assert_company_chat_enabled('||company_arg||');','i');
  if changed=definition then raise exception 'Chat RPC entry missing: %',f.proname;end if;
  execute changed;
  count_changed:=count_changed+1;
 end loop;
 if count_changed<>3 then raise exception 'Expected exactly 3 chat RPCs; found %',count_changed;end if;
end $$;
