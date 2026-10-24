do $$
declare d text;v_changed text;
begin
 select pg_get_functiondef('public.essential_planning_report(uuid,timestamptz,timestamptz)'::regprocedure) into d;
 v_changed:=replace(d,'s.worker_id is not null and s.starts_at<=w.a','s.worker_id is not null and exists(select 1 from public.company_workers cw where cw.id=s.worker_id and cw.status=''active'') and s.starts_at<=w.a');
 if v_changed=d then raise exception 'Coverage source changed';end if;execute v_changed;
 select pg_get_functiondef('public.cancel_essential_shift_request(uuid)'::regprocedure) into d;
 v_changed:=replace(d,'update public.essential_shift_requests set status=''cancelled'' where id=r.id;',E'update public.essential_shift_requests set status=''cancelled'',reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=''Annulée par le demandeur'' where id=r.id;\n insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,reason) values(r.company_id,auth.uid(),''shift_change_cancelled'',r.id,to_jsonb(r),''Annulée par le demandeur'');');
 if v_changed=d then raise exception 'Cancellation source changed';end if;execute v_changed;
end $$;
