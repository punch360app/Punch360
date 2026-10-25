-- Session timeboxes are enforced both at registration and immediately before delivery.
do $migration$
declare signature text;source text;changed text;
begin
 foreach signature in array array['public.register_push_device(uuid,text,text)','private.enqueue_notification_push()','public.claim_push_delivery()'] loop
  source:=pg_get_functiondef(signature::regprocedure);
  changed:=replace(source,'from auth.sessions where id=','from auth.sessions where (not_after is null or not_after>clock_timestamp()) and id=');
  if changed=source then raise exception 'Push session source changed: %',signature;end if;execute changed;
 end loop;
end $migration$;
