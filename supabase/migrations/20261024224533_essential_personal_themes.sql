-- One personal preference per verified identity, shared across its personal devices.
create table public.essential_appearance (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme_id text not null default 'sage' check(theme_id in ('slate','linen','nordic','taupe','sand','cloud','sage','beige','carbon','pearl')),
 updated_at timestamptz not null default now()
);
alter table public.essential_appearance enable row level security;
create policy essential_appearance_read on public.essential_appearance for select to authenticated using(user_id=(select auth.uid()));
create policy essential_appearance_insert on public.essential_appearance for insert to authenticated with check(user_id=(select auth.uid()));
create policy essential_appearance_update on public.essential_appearance for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert(user_id,theme_id),update(theme_id) on public.essential_appearance to authenticated;
revoke all on public.essential_appearance from anon;
create function private.appearance_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function private.appearance_timestamp() from public,anon,authenticated;
create trigger appearance_timestamp before update on public.essential_appearance for each row execute function private.appearance_timestamp();
