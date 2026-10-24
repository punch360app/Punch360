alter table private.kiosk_devices add column idle_seconds integer not null default 10 check(idle_seconds in (5,10,15,30,60));
create function public.set_kiosk_idle(p_device uuid,p_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;
begin
 select * into d from private.kiosk_devices where id=p_device for update;
 if not found or d.revoked_at is not null or not private.can_administer(d.company_id) then raise exception using errcode='42501',message='Responsable de la borne requis';end if;
 if p_seconds is null or p_seconds not in (5,10,15,30,60) then raise exception 'Durée invalide';end if;
 update private.kiosk_devices set idle_seconds=p_seconds where id=d.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason) values(d.company_id,auth.uid(),'kiosk_idle',d.id,jsonb_build_object('seconds',d.idle_seconds),jsonb_build_object('seconds',p_seconds),'Délai de confidentialité de la borne');
end $$;
revoke all on function public.set_kiosk_idle(uuid,integer) from public,anon;
grant execute on function public.set_kiosk_idle(uuid,integer) to authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.list_kiosk_devices(uuid)'::regprocedure) into definition;
 if position('idle_seconds' in definition)=0 then execute replace(definition,'''last_seen_at'',d.last_seen_at','''last_seen_at'',d.last_seen_at,''idle_seconds'',d.idle_seconds');end if;
 select pg_get_functiondef('public.kiosk_pair_device(text)'::regprocedure) into definition;
 if position('idle_seconds' in definition)=0 then execute replace(definition,'''company_name'',','''idle_seconds'',d.idle_seconds,''company_name'',');end if;
 select pg_get_functiondef('public.kiosk_execute(uuid,text,text,text,text,uuid,text)'::regprocedure) into definition;
 if position('idle_seconds' in definition)=0 then execute replace(definition,'''server_time'',now_at','''idle_seconds'',d.idle_seconds,''server_time'',now_at');end if;
end $$;
