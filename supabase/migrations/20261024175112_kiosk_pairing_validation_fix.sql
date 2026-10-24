create or replace function public.kiosk_pair_device(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.kiosk_devices;v_device uuid;token text;
begin
 if p_code is null or p_code !~ '^[0-9a-f-]{36}\.[0-9a-f]{64}$' then return jsonb_build_object('ok',false);end if;
 v_device:=split_part(p_code,'.',1)::uuid;
 select * into d from private.kiosk_devices where kiosk_devices.id=v_device for update;
 if not found or d.revoked_at is not null or d.paired_at is not null or d.pair_expires_at<=clock_timestamp() or d.pair_hash is distinct from sha256(convert_to(split_part(p_code,'.',2),'UTF8')) then return jsonb_build_object('ok',false);end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update private.kiosk_devices set paired_at=clock_timestamp(),pair_hash=null,token_hash=sha256(convert_to(token,'UTF8')),last_seen_at=clock_timestamp() where kiosk_devices.id=v_device;
 return jsonb_build_object('ok',true,'device_id',v_device,'token',token,'name',d.name,'company_name',(select name from public.companies where companies.id=d.company_id));
end $$;

do $$
declare d text;
begin
 select pg_get_functiondef('public.kiosk_execute(uuid,text,text,text,text,uuid,text)'::regprocedure) into d;
 execute replace(d,'select * into s from public.punch_sessions',E'now_at:=clock_timestamp();\n select * into s from public.punch_sessions');
end $$;
