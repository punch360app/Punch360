create index platform_audit_page on private.platform_audit(created_at desc,id desc);
create function public.platform_search_audit(p_query text default '',p_entity uuid default null,p_from timestamptz default null,p_until timestamptz default null,p_before timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_live_platform_session();
 if length(coalesce(p_query,''))>160 or (p_from is not null and p_until is not null and p_from>=p_until) then raise exception 'Filtres invalides';end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc) from (
 select id,actor_id,action,entity_id,detail,created_at from private.platform_audit
 where (coalesce(p_query,'')='' or position(lower(p_query) in lower(action))>0)
 and (p_entity is null or entity_id=p_entity) and (p_from is null or created_at>=p_from) and (p_until is null or created_at<p_until)
 and (p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 order by created_at desc,id desc limit 100)t),'[]'::jsonb);
end $$;
revoke all on function public.platform_search_audit(text,uuid,timestamptz,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.platform_search_audit(text,uuid,timestamptz,timestamptz,timestamptz,uuid) to authenticated;
