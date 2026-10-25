create function private.auto_worker_invitation_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.auth_user_id is null and new.status='active' and new.personal_access and new.email is not null and exists(select 1 from public.invitation_delivery_settings where company_id=new.company_id and email_auto) and exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then
  perform public.create_worker_invitation(new.id);
 end if;return new;
end $$;
revoke all on function private.auto_worker_invitation_email() from public,anon,authenticated;
create trigger auto_worker_invitation_email after insert on public.company_workers for each row execute function private.auto_worker_invitation_email();
