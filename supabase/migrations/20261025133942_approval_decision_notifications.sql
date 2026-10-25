create function private.notify_approval_decision() returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb;requester uuid;worker_user uuid;label text;
begin
 if new.status is not distinct from old.status or new.status not in('approved','rejected') or not exists(select 1 from public.companies where id=new.company_id and product_edition='essential') then return new;end if;
 data:=to_jsonb(new);
 if TG_TABLE_NAME='leave_requests' then requester:=(data->>'user_id')::uuid;worker_user:=requester;label:='Congé';
 else
  requester:=(data->>'requested_by')::uuid;
  select coalesce(w.auth_user_id,s.user_id) into worker_user from public.punch_sessions s left join public.company_workers w on w.id=s.worker_id and w.company_id=s.company_id where s.id=(data->>'session_id')::uuid and s.company_id=new.company_id;
  label:=case when TG_TABLE_NAME='essential_break_corrections' then 'Correction de pause' else 'Correction d’heures' end;
 end if;
 insert into public.app_notifications(company_id,recipient_id,kind,title,body)
 select new.company_id,m.user_id,TG_TABLE_NAME||'_decision',label||case when new.status='approved' then ' approuvée' else ' refusée' end,'La décision de votre responsable est disponible dans vos demandes.' from public.company_members m where m.company_id=new.company_id and m.status='active' and (m.user_id=requester or m.user_id=worker_user);
 return new;
end $$;
revoke all on function private.notify_approval_decision() from public,anon,authenticated;
create trigger punch_correction_decision after update of status on public.punch_correction_requests for each row execute function private.notify_approval_decision();
create trigger break_correction_decision after update of status on public.essential_break_corrections for each row execute function private.notify_approval_decision();
create trigger leave_decision after update of status on public.leave_requests for each row execute function private.notify_approval_decision();
