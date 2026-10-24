-- PUNCH 360: explicit, least-privilege Data API grants after RLS has been installed.
-- Avoid default Supabase authenticated table-wide UPDATE overriding column permissions.
revoke all privileges on all tables in schema public from anon,authenticated;

grant select on public.companies,public.company_members,public.jobs,public.job_assignments,
 public.punch_sessions,public.punch_segments,public.punch_archive_preferences,
 public.punch_correction_requests,public.job_documents,public.material_orders,
 public.leave_requests,public.employee_profiles,public.emergency_contacts,
 public.employee_credentials,public.teams,public.team_members,
 public.conversations,public.conversation_members,public.conversation_messages
to authenticated;

grant update(name) on public.companies to authenticated;
grant insert(company_id,number,name,address,latitude,longitude,photo_url,active) on public.jobs to authenticated;
grant update(number,name,address,latitude,longitude,photo_url,active) on public.jobs to authenticated;
grant insert(company_id,job_id,user_id,active,planned_start),
 update(active,planned_start) on public.job_assignments to authenticated;
grant insert,delete on public.punch_archive_preferences to authenticated;
grant insert(company_id,session_id,requested_by,requested_start,requested_end,reason)
 on public.punch_correction_requests to authenticated;
grant insert(company_id,job_id,name,kind,storage_path,version,requires_ack,created_by)
 on public.job_documents to authenticated;
grant insert(company_id,job_id,created_by,note) on public.material_orders to authenticated;
grant insert(company_id,user_id,leave_type,begins_on,ends_on,reason)
 on public.leave_requests to authenticated;
grant insert(user_id,full_name,phone,photo_path),
 update(user_id,full_name,phone,photo_path) on public.employee_profiles to authenticated;
grant insert(user_id,name,relationship,phone,priority),
 update(user_id,name,relationship,phone,priority),delete on public.emergency_contacts to authenticated;
grant insert(user_id,credential_type,trade,expires_on,storage_path),
 update(user_id,credential_type,trade,expires_on,storage_path),delete on public.employee_credentials to authenticated;
grant insert(company_id,conversation_id,sender_id,body) on public.conversation_messages to authenticated;
