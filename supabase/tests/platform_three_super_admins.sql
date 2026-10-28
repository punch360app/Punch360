-- Run AFTER 20261028124000_platform_three_super_admins.sql.
-- All synthetic users/roles/audit rows are rolled back, never persistent.
begin;
do $$
declare
 v_root uuid;v_sid uuid:=gen_random_uuid();v_a uuid:=gen_random_uuid();
 v_b uuid:=gen_random_uuid();v_c uuid:=gen_random_uuid();v_del_session uuid:=gen_random_uuid();
 v_obj jsonb;v_error text;
begin
 select user_id into strict v_root from private.platform_owner where owner_role='root';
 if (select count(*) from private.platform_owner)<>1 then
  raise exception 'This test requires the existing root and no real secondary Super Admin yet';
 end if;
 insert into auth.users(id,email,email_confirmed_at)
 values(v_a,'three-admin-a-'||v_a::text||'@punch360.test.invalid',clock_timestamp()),
       (v_b,'three-admin-b-'||v_b::text||'@punch360.test.invalid',clock_timestamp()),
       (v_c,'three-admin-c-'||v_c::text||'@punch360.test.invalid',clock_timestamp());
 insert into auth.sessions(id,user_id,aal,not_after)
 values(v_sid,v_root,'aal2',clock_timestamp()+interval '1 hour'),
       (v_del_session,v_a,'aal2',clock_timestamp()+interval '1 hour');
 perform set_config('request.jwt.claim.sub',v_root::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_root,'session_id',v_sid,'aal','aal2')::text,true);
 execute 'set local role authenticated';
 v_obj:=public.platform_admin_members();
 if (v_obj->>'count')::integer<>1 or (v_obj->>'is_root')::boolean is not true then
  raise exception 'Existing platform root missing after migration';
 end if;
 begin
  perform public.platform_admin_add('three-admin-a-'||v_a::text||'@punch360.test.invalid',
    'WRONG','Synthetic reversible test of owner-only addition');
  raise exception 'Grant accepted without typed confirmation';
 exception when others then
  if sqlerrm='Grant accepted without typed confirmation' then raise;end if;
 end;
 v_obj:=public.platform_admin_add('three-admin-a-'||v_a::text||'@punch360.test.invalid',
  'AJOUTER three-admin-a-'||v_a::text||'@punch360.test.invalid',
  'Synthetic reversible test of first delegated admin');
 if (v_obj->>'count')::integer<>2 then raise exception 'Second admin was not added';end if;
 v_obj:=public.platform_admin_add('three-admin-b-'||v_b::text||'@punch360.test.invalid',
  'AJOUTER three-admin-b-'||v_b::text||'@punch360.test.invalid',
  'Synthetic reversible test of second delegated admin');
 if (v_obj->>'count')::integer<>3 then raise exception 'Third admin was not added';end if;
 begin
  perform public.platform_admin_add('three-admin-c-'||v_c::text||'@punch360.test.invalid',
   'AJOUTER three-admin-c-'||v_c::text||'@punch360.test.invalid',
   'Synthetic reversible test of maximum account limit');
  raise exception 'A fourth Super Admin was accepted';
 exception when others then
  if sqlerrm='A fourth Super Admin was accepted' then raise;end if;
 end;
 begin
  perform public.platform_admin_remove(v_root,
   'RETIRER root@example.invalid','Synthetic protection test for immutable original owner');
  raise exception 'Original root account was removable';
 exception when others then
  if sqlerrm='Original root account was removable' then raise;end if;
 end;
 perform set_config('request.jwt.claim.sub',v_a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'session_id',v_del_session,'aal','aal2')::text,true);
 if public.platform_access() is not true then raise exception 'Delegate cannot use platform access';end if;
 begin
  perform public.platform_admin_remove(v_b,
   'RETIRER three-admin-b-'||v_b::text||'@punch360.test.invalid',
   'Delegate may not revoke another administrator');
  raise exception 'Delegate removed another admin';
 exception when others then
  if sqlerrm='Delegate removed another admin' then raise;end if;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'session_id',v_del_session,'aal','aal1')::text,true);
 begin
  perform public.platform_admin_members();
  raise exception 'Session without MFA obtained directory';
 exception when others then
  if sqlerrm='Session without MFA obtained directory' then raise;end if;
 end;
 perform set_config('request.jwt.claim.sub',v_root::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_root,'session_id',v_sid,'aal','aal2')::text,true);
 v_obj:=public.platform_admin_remove(v_a,
   'RETIRER three-admin-a-'||v_a::text||'@punch360.test.invalid',
   'Synthetic reversible revocation test');
 if (v_obj->>'count')::integer<>2 then raise exception 'Delegate removal failed';end if;
 v_obj:=public.platform_admin_add('three-admin-c-'||v_c::text||'@punch360.test.invalid',
   'AJOUTER three-admin-c-'||v_c::text||'@punch360.test.invalid',
   'Synthetic reversible replacement after removal');
 if (v_obj->>'count')::integer<>3 then raise exception 'Freed slot could not be reused';end if;
 execute 'reset role';
end $$;
rollback;
