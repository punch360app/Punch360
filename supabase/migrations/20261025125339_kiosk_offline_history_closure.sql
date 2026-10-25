create function private.check_pending_offline_events() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reopened_at is null and exists(select 1 from private.kiosk_offline_events where company_id=new.company_id and state='pending' and occurred_at>=(new.week_start::timestamp at time zone 'America/Toronto') and occurred_at<((new.week_start+7)::timestamp at time zone 'America/Toronto')) then raise exception 'Réconcilier les observations hors ligne avant de fermer la semaine';end if;return new;
end $$;
revoke all on function private.check_pending_offline_events() from public,anon,authenticated;
create trigger pending_offline_events before insert or update on public.payroll_weeks for each row execute function private.check_pending_offline_events();
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('private.company_archive_payload(uuid)'::regprocedure);
 changed:=replace(source,$old$select 'private.kiosk_events' as collection$old$,$new$select 'private.kiosk_offline_events' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.kiosk_offline_events t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.kiosk_events' as collection$new$);
 if changed=source then raise exception 'Archive source changed: inspect before migration';end if;execute changed;
 source:=pg_get_functiondef('public.review_kiosk_offline(uuid,boolean,text)'::regprocedure);
 changed:=replace(source,$old$ return jsonb_build_object('approved',p_approve,'new_sessions',created);$old$,$new$ insert into public.app_notifications(company_id,recipient_id,kind,title,body) select g.company_id,m.user_id,'kiosk_offline_decision',case when p_approve then 'Pointages hors ligne confirmés' else 'Pointages hors ligne refusés' end,trim(p_note) from public.company_members m where m.company_id=g.company_id and m.user_id=w.auth_user_id and m.status='active';
 return jsonb_build_object('approved',p_approve,'new_sessions',created);$new$);
 if changed=source then raise exception 'Offline review source changed: inspect before migration';end if;execute changed;
end $migration$;
