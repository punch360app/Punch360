alter table private.kiosk_offline_grants add column review_result jsonb;
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.review_kiosk_offline(uuid,boolean,text)'::regprocedure);
 changed:=replace(source,$old$ if g.closed_at is not null then raise exception 'Lot déjà traité';end if;$old$,$new$ if g.closed_at is not null then
  if g.review_result is not null and not exists(select 1 from private.kiosk_offline_events where grant_id=g.id and (state is distinct from (case when p_approve then 'approved' else 'rejected' end) or reviewed_by is distinct from auth.uid() or review_note is distinct from trim(p_note))) then return g.review_result;end if;
  raise exception 'Lot déjà traité';
 end if;$new$);
 if changed=source then raise exception 'Review source changed: inspect before migration';end if;
 changed:=replace(changed,$old$update private.kiosk_offline_grants set closed_at=clock_timestamp() where id=g.id;$old$,$new$update private.kiosk_offline_grants set closed_at=clock_timestamp(),review_result=jsonb_build_object('approved',p_approve,'new_sessions',created) where id=g.id;$new$);
 execute changed;
end $migration$;
