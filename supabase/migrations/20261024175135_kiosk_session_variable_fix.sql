do $$
declare d text;
begin
 select pg_get_functiondef('public.kiosk_execute(uuid,text,text,text,text,uuid,text)'::regprocedure) into d;
 d:=replace(d,'session_id uuid;','v_session uuid;');
 d:=replace(d,'returning id into session_id;','returning id into v_session;');
 d:=replace(d,'values(d.company_id,session_id,d.site_id,now_at)','values(d.company_id,v_session,d.site_id,now_at)');
 d:=replace(d,'session_id:=s.id','v_session:=s.id');
 d:=replace(d,'''session_id'',session_id','''session_id'',v_session');
 execute d;
end $$;
