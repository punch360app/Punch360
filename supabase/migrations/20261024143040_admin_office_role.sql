-- Office administrators manage records; only field roles may create their own time events.
create function private.assert_field_punch(p_company uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and status='active' and role in ('employee','lead','boss')) then
  raise exception using errcode='42501',message='Le rôle Admin est réservé à la gestion et ne peut pas puncher.';
 end if;
end $$;
revoke all on function private.assert_field_punch(uuid) from public,anon,authenticated;
-- Preserve the exact existing implementations and API signatures, including offline idempotence.
do $$
declare f record; definition text; changed text; n integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname in ('punch_with_location','sync_punch_event','sync_break_event') loop
  definition:=pg_get_functiondef(f.oid);
  changed:=regexp_replace(definition,'\mbegin\M',E'begin\n perform private.assert_field_punch(p_company);','i');
  if changed=definition then raise exception 'Missing function entry point';end if;
  execute changed;n:=n+1;
 end loop;
 if n<>3 then raise exception 'Expected exactly three punch entry points';end if;
end $$;
