create function private.company_archive_payload(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 -- One SELECT statement supplies one MVCC snapshot for every business collection.
 select jsonb_build_object('format','punch-company-data','version',1,'project','mlabstdxxwjdpfaxiwmg','company_id',p_company,'company_name',(select name from public.companies where id=p_company),'exported_at',statement_timestamp(),
 'collections',(select jsonb_object_agg(collection,rows) from (
select 'public.companies' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.companies t where id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.app_notifications' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.app_notifications t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.company_members' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.company_members t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.company_workers' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.company_workers t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.conversation_members' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.conversation_members t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.conversation_messages' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.conversation_messages t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.conversations' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.conversations t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_announcements' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_announcements t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_availability' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_availability t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_bank_entries' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_bank_entries t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_break_corrections' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_break_corrections t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_certifications' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_certifications t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_departments' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_departments t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_hr_documents' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_hr_documents t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_hr_grants' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_hr_grants t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_locations' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_locations t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_pay_credits' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_pay_credits t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_pay_rates' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_pay_rates t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_pay_rules' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_pay_rules t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_payroll_estimates' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_payroll_estimates t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_shift_notes' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_shift_notes t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_shift_requests' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_shift_requests t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_subscriptions' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_subscriptions t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_supervisors' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_supervisors t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.job_assignments' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.job_assignments t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.job_documents' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.job_documents t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.jobs' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.jobs t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.leave_requests' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.leave_requests t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.material_orders' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.material_orders t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.payroll_weeks' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.payroll_weeks t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_breaks' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_breaks t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_correction_requests' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_correction_requests t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_event_receipts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_event_receipts t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_location_checks' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_location_checks t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_segments' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_segments t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.punch_sessions' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.punch_sessions t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.scheduled_shifts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.scheduled_shifts t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.team_jobs' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.team_jobs t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.team_members' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.team_members t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.teams' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.teams t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.workforce_audit' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.workforce_audit t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_billing_accounts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_billing_accounts t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_billing_orders' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_billing_orders t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_contracts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_contracts t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_notice_keys' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_notice_keys t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_paid_break_receipts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_paid_break_receipts t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_schedule_batches' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_schedule_batches t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_stripe_events' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_stripe_events t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_stripe_invoices' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_stripe_invoices t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.essential_test_plans' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.essential_test_plans t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.kiosk_events' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.kiosk_events t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.kiosk_security_audit' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.kiosk_security_audit t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.support_tickets' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.support_tickets t where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.document_acknowledgements' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.document_acknowledgements t join public.job_documents d on d.id=t.document_id where d.company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_hr_receipts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_hr_receipts t join public.essential_hr_documents d on d.id=t.document_id where d.company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_announcement_receipts' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_announcement_receipts t join public.essential_announcements d on d.id=t.announcement_id where d.company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'public.essential_shift_acknowledgements' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from public.essential_shift_acknowledgements t join public.scheduled_shifts d on d.id=t.shift_id where d.company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.support_messages' as collection,coalesce((select jsonb_agg(row order by row::text) from (select to_jsonb(t) as row from private.support_messages t join private.support_tickets d on d.id=t.ticket_id where d.company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.company_invitations' as collection,coalesce((select jsonb_agg(row order by row::text) from (select jsonb_build_object('id',id,'company_id',company_id,'email',email,'role',role,'created_by',created_by,'created_at',created_at,'expires_at',expires_at,'accepted_by',accepted_by,'accepted_at',accepted_at,'revoked_at',revoked_at) as row from private.company_invitations where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.worker_invitations' as collection,coalesce((select jsonb_agg(row order by row::text) from (select jsonb_build_object('id',id,'company_id',company_id,'worker_id',worker_id,'email',email,'phone',phone,'created_by',created_by,'created_at',created_at,'expires_at',expires_at,'accepted_at',accepted_at,'accepted_by',accepted_by,'revoked_at',revoked_at,'sms_status',sms_status) as row from private.worker_invitations where company_id=p_company) source),'[]'::jsonb) as rows
union all
select 'private.kiosk_devices' as collection,coalesce((select jsonb_agg(row order by row::text) from (select jsonb_build_object('id',id,'company_id',company_id,'site_id',site_id,'name',name,'paired_at',paired_at,'revoked_at',revoked_at,'last_seen_at',last_seen_at,'created_by',created_by,'idle_seconds',idle_seconds) as row from private.kiosk_devices where company_id=p_company) source),'[]'::jsonb) as rows
 ) collections),
 'files',coalesce((select jsonb_agg(jsonb_build_object('bucket',w.bucket,'path',w.path,'required',w.required,'exists',o.id is not null,'size',coalesce((o.metadata->>'size')::bigint,0),'mimetype',o.metadata->>'mimetype') order by w.bucket,w.path) from (
 select bucket,path,bool_or(required) as required from (
 select 'essential-hr'::text as bucket,storage_path as path,state<>'draft' as required from public.essential_hr_documents where company_id=p_company
 union all select 'job-documents',storage_path,true from public.job_documents where company_id=p_company
 ) refs group by bucket,path
 ) w left join storage.objects o on o.bucket_id=w.bucket and o.name=w.path),'[]'::jsonb),
 'excluded',jsonb_build_array('auth_credentials','pin_and_enrollment_secrets','device_and_invitation_tokens','personal_account_settings_and_private_contacts','global_platform_data')) into payload;
 return payload;
end $$;
revoke all on function private.company_archive_payload(uuid) from public,anon,authenticated;
