-- Applies MFA to legacy platform mutations as well as the new plan editor.
create or replace function private.assert_platform_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_access() then raise exception using errcode='42501',message='Accès plateforme refusé';end if;
 if (select auth.jwt()->>'aal') is distinct from 'aal2' then raise exception using errcode='42501',message='Authentification à deux facteurs requise';end if;
end $$;
revoke all on function private.assert_platform_owner() from public,anon,authenticated;
