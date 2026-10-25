-- All legacy platform callers now inherit the same live session requirement.
create or replace function private.assert_platform_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_access() then raise exception using errcode='42501',message='Accès plateforme refusé';end if;
 if auth.jwt()->>'aal' is distinct from 'aal2' then raise exception using errcode='42501',message='Authentification à deux facteurs requise';end if;
 if not exists(select 1 from auth.sessions where id::text=auth.jwt()->>'session_id' and user_id=auth.uid() and aal='aal2' and (not_after is null or not_after>clock_timestamp())) then raise exception using errcode='42501',message='Session MFA expirée : se reconnecter';end if;
end $$;
revoke all on function private.assert_platform_owner() from public,anon,authenticated;
create index platform_companies_created on public.companies(created_at desc,id desc);
create function public.platform_search_companies(p_query text default '',p_edition text default null,p_test boolean default null,p_status text default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare results jsonb;more boolean;cursor_time timestamptz;cursor_id uuid;
begin
 perform private.assert_platform_owner();
 if length(coalesce(p_query,''))>200 or (p_edition is not null and p_edition not in('essential','construction')) or (p_before is null)<>(p_before_id is null) then raise exception 'Filtres ou curseur invalides';end if;
 with matches as(select id,name,product_edition,is_test,billing_mode,billing_status,seat_limit,created_at from public.companies where (p_edition is null or product_edition=p_edition) and (p_test is null or is_test=p_test) and (p_status is null or billing_status=p_status) and (coalesce(trim(p_query),'')='' or strpos(lower(name),lower(trim(p_query)))>0 or id::text=trim(p_query)) and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 51),page as(select * from matches order by created_at desc,id desc limit 50)
 select coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from page p),'[]'),(select count(*)>50 from matches),(select created_at from page order by created_at,id limit 1),(select id from page order by created_at,id limit 1) into results,more,cursor_time,cursor_id;
 return jsonb_build_object('items',results,'has_more',more,'before',case when more then cursor_time end,'before_id',case when more then cursor_id end);
end $$;
revoke all on function public.platform_search_companies(text,text,boolean,text,timestamptz,uuid) from public,anon;
grant execute on function public.platform_search_companies(text,text,boolean,text,timestamptz,uuid) to authenticated;
