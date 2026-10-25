-- Preferences are personal per company; the durable internal inbox remains available.
create table public.notification_preferences(
 company_id uuid not null references public.companies(id),user_id uuid not null references auth.users(id),
 category text not null check(category in('schedule','decisions','announcements','reminders','other')),
 push_enabled boolean not null default false,email_enabled boolean not null default false,
 version integer not null default 1,updated_at timestamptz not null default now(),primary key(company_id,user_id,category)
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences for select to authenticated using(user_id=(select auth.uid()) and private.is_member(company_id));
grant select on public.notification_preferences to authenticated;
revoke insert,update,delete on public.notification_preferences from anon,authenticated;
create function public.set_notification_preference(p_company uuid,p_category text,p_push boolean,p_email boolean,p_expected_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare pref public.notification_preferences;v integer;
begin
 if not private.is_member(p_company) then raise exception using errcode='42501',message='Membre actif requis';end if;
 if p_category is null or p_category not in('schedule','decisions','announcements','reminders','other') or p_push is null or p_email is null then raise exception 'Préférence invalide';end if;
 perform pg_advisory_xact_lock(hashtextextended('notification-preference:'||p_company::text||auth.uid()::text||p_category,0));
 select * into pref from public.notification_preferences where company_id=p_company and user_id=auth.uid() and category=p_category for update;
 if coalesce(pref.version,0) is distinct from p_expected_version then raise exception 'Préférence modifiée : actualiser';end if;
 insert into public.notification_preferences(company_id,user_id,category,push_enabled,email_enabled) values(p_company,auth.uid(),p_category,p_push,p_email)
 on conflict(company_id,user_id,category) do update set push_enabled=excluded.push_enabled,email_enabled=excluded.email_enabled,version=notification_preferences.version+1,updated_at=clock_timestamp() returning version into v;return v;
end $$;
revoke all on function public.set_notification_preference(uuid,text,boolean,boolean,integer) from public,anon;
grant execute on function public.set_notification_preference(uuid,text,boolean,boolean,integer) to authenticated;
