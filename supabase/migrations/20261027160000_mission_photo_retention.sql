-- MISSION-007/013, SEC-014: expire photo evidence using Storage API, never SQL object deletion.
-- Internal cron credential is random, encrypted in Vault, never committed.
create extension if not exists pg_net;
alter table private.essential_mission_photos
 add column cleanup_claim_token uuid,
 add column cleanup_claimed_at timestamptz,
 add column cleanup_attempts integer not null default 0 check(cleanup_attempts>=0),
 add constraint mission_photo_cleanup_claim_pair check
 ((cleanup_claim_token is null)=(cleanup_claimed_at is null));
create index mission_photo_expired_unlinked_idx
 on private.essential_mission_photos(expires_at,cleanup_attempts) where state in('pending','ready');
create index mission_photo_expired_linked_idx
 on private.essential_mission_photos(retention_until,cleanup_attempts) where state='linked';
create table private.mission_photo_retention_auth (
 singleton boolean primary key default true check(singleton),token_hash bytea not null);
alter table private.mission_photo_retention_auth enable row level security;
revoke all on private.mission_photo_retention_auth from public,anon,authenticated;
do $token$
declare secret text;
begin
 if exists(select 1 from vault.secrets where name='punch-mission-photo-retention-v1') then
   raise exception 'Photo retention Vault key already exists; do not overwrite';
 end if;
 secret:=encode(extensions.gen_random_bytes(32),'hex');
 perform vault.create_secret(secret,'punch-mission-photo-retention-v1',
   'Internal pg_cron to Edge mission photo expiration');
 insert into private.mission_photo_retention_auth(singleton,token_hash)
 values(true,extensions.digest(secret,'sha256'));
end $token$;
create function public.mission_photo_retention_authorized(p_token text)
 returns boolean language sql stable security definer set search_path='' as $fn$
 select p_token is not null and length(p_token)=64 and exists(
  select 1 from private.mission_photo_retention_auth a where a.singleton
  and a.token_hash=extensions.digest(p_token,'sha256'));
$fn$;
create function public.claim_expired_mission_photos(p_limit integer default 25)
 returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>25 then
   raise exception using errcode='22023',message='Lot de nettoyage invalide';end if;
 with due as (
  select f.id from private.essential_mission_photos f
  where ((f.state in('pending','ready') and f.expires_at<=clock_timestamp())
   or (f.state='linked' and f.retention_until is not null and f.retention_until<=clock_timestamp()))
   and (f.cleanup_claimed_at is null or f.cleanup_claimed_at<clock_timestamp()-interval '20 minutes')
  order by f.cleanup_attempts,coalesce(f.retention_until,f.expires_at),f.id
  for update skip locked limit p_limit
 ), claimed as (
  update private.essential_mission_photos f
  set cleanup_claim_token=gen_random_uuid(),cleanup_claimed_at=clock_timestamp(),
      cleanup_attempts=f.cleanup_attempts+1
  from due where f.id=due.id
  returning f.id,f.company_id,f.mission_id,f.storage_path,f.cleanup_claim_token
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'company',company_id,
  'mission',mission_id,'path',storage_path,'claim',cleanup_claim_token)),'[]'::jsonb)
 into result from claimed;
 return result;
end $fn$;
create function public.finish_expired_mission_photo(p_photo uuid,p_claim uuid,p_deleted boolean)
 returns boolean language plpgsql security definer set search_path='' as $fn$
declare f private.essential_mission_photos;
begin
 if p_photo is null or p_claim is null or p_deleted is null then
   raise exception using errcode='22023',message='Résultat de purge invalide';end if;
 select * into f from private.essential_mission_photos where id=p_photo for update;
 if not found or f.cleanup_claim_token is distinct from p_claim then return false;end if;
 if not p_deleted then
   update private.essential_mission_photos set cleanup_claim_token=null,cleanup_claimed_at=null where id=p_photo;
   return false;
 end if;
 if not ((f.state in('pending','ready') and f.expires_at<=clock_timestamp())
  or (f.state='linked' and f.retention_until is not null and f.retention_until<=clock_timestamp())) then
   raise exception using errcode='22023',message='La photo n’est plus expirée';end if;
 update private.essential_missions m set completion_photo_id=null
 where m.company_id=f.company_id and m.id=f.mission_id and m.completion_photo_id=f.id;
 delete from private.essential_mission_photos where id=f.id;
 return true;
end $fn$;
revoke all on function public.mission_photo_retention_authorized(text),
 public.claim_expired_mission_photos(integer),
 public.finish_expired_mission_photo(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.mission_photo_retention_authorized(text),
 public.claim_expired_mission_photos(integer),
 public.finish_expired_mission_photo(uuid,uuid,boolean) to service_role;
-- pg_cron uses Vault at execution time; cron.job never contains the token.
select cron.schedule('punch-mission-photo-expiration','17 * * * *',$job$
 select net.http_post(
 url:='https://mlabstdxxwjdpfaxiwmg.supabase.co/functions/v1/mission-photo-retention',
 headers:=jsonb_build_object('Content-Type','application/json',
 'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets
 where name='punch-mission-photo-retention-v1')),
 body:='{}'::jsonb,timeout_milliseconds:=30000);
$job$);