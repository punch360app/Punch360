create function public.platform_seed_test_team(p_company uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare lead_id uuid; team_id uuid;
begin
 perform private.assert_platform_owner();
 if not exists(select 1 from public.companies where id=p_company and is_test and product_edition='construction') then raise exception 'Compagnie Chantier de test obligatoire';end if;
 select m.user_id into lead_id from public.company_members m join private.test_accounts t on t.user_id=m.user_id and t.company_id=m.company_id where m.company_id=p_company and m.role='lead' and m.status='active' limit 1;
 if lead_id is null then raise exception 'Créer un compte Chef de test avant l’équipe';end if;
 insert into public.teams(company_id,name,lead_user_id) values(p_company,'Équipe fictive',lead_id) returning id into team_id;
 insert into public.team_members(company_id,team_id,user_id) select p_company,team_id,m.user_id from public.company_members m join private.test_accounts t on t.user_id=m.user_id and t.company_id=m.company_id where m.company_id=p_company and m.role in ('employee','lead') and m.status='active';
 insert into public.team_jobs(company_id,team_id,job_id) select p_company,team_id,id from public.jobs where company_id=p_company;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'test_team_created',team_id,jsonb_build_object('company',p_company));
 return team_id;
end $$;
revoke all on function public.platform_seed_test_team(uuid) from public,anon;grant execute on function public.platform_seed_test_team(uuid) to authenticated;
-- A disabled/missing leader must not pass a nullable role comparison.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.create_team(uuid,text,uuid)'::regprocedure) into definition;
 execute replace(definition,'if v_role<>''lead''','if v_role is distinct from ''lead''');
end $$;
create function public.lead_team_overview(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d timestamptz:=date_trunc('day',now() at time zone 'America/Toronto') at time zone 'America/Toronto'; w timestamptz:=date_trunc('week',now() at time zone 'America/Toronto') at time zone 'America/Toronto';
begin
 if not exists(select 1 from public.company_members where company_id=p_company and user_id=auth.uid() and role='lead' and status='active') then raise exception using errcode='42501',message='Accès chef requis';end if;
 return coalesce((with people as (
  select distinct tm.user_id from public.teams t join public.team_members tm on tm.company_id=t.company_id and tm.team_id=t.id join public.company_members m on m.company_id=tm.company_id and m.user_id=tm.user_id where t.company_id=p_company and t.lead_user_id=auth.uid() and m.status='active'
 ), visible_segments as (
  select ps.*,s.user_id from public.punch_segments ps join public.punch_sessions s on s.company_id=ps.company_id and s.id=ps.session_id where ps.company_id=p_company and private.lead_sees_job_for_worker(p_company,s.user_id,ps.job_id)
 )select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',coalesce(nullif(ep.full_name,''),left(p.user_id::text,8)),
 'present',exists(select 1 from visible_segments vs where vs.user_id=p.user_id and vs.ended_at is null),
 'today_gross_ms',coalesce((select sum(greatest(0,extract(epoch from (least(coalesce(vs.ended_at,now()),now())-greatest(vs.started_at,d))))*1000) from visible_segments vs where vs.user_id=p.user_id and coalesce(vs.ended_at,now())>d),0),
 'week_gross_ms',coalesce((select sum(greatest(0,extract(epoch from (least(coalesce(vs.ended_at,now()),now())-greatest(vs.started_at,w))))*1000) from visible_segments vs where vs.user_id=p.user_id and coalesce(vs.ended_at,now())>w),0))) from people p left join public.employee_profiles ep on ep.user_id=p.user_id),'[]'::jsonb);
end $$;
revoke all on function public.lead_team_overview(uuid) from public,anon;grant execute on function public.lead_team_overview(uuid) to authenticated;
create function public.company_dashboard(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d timestamptz:=date_trunc('day',now() at time zone 'America/Toronto') at time zone 'America/Toronto'; w timestamptz:=date_trunc('week',now() at time zone 'America/Toronto') at time zone 'America/Toronto';
begin
 if not private.is_manager(p_company) then raise exception using errcode='42501',message='Gestionnaire requis';end if;
 return jsonb_build_object('active_members',(select count(*) from public.company_members where company_id=p_company and status='active'),
 'present',(select count(distinct user_id) from public.punch_sessions where company_id=p_company and ended_at is null),
 'approved_absences_today',(select count(distinct user_id) from public.leave_requests where company_id=p_company and status='approved' and (now() at time zone 'America/Toronto')::date between begins_on and ends_on),
 'today_gross_ms',coalesce((select sum(greatest(0,extract(epoch from (least(coalesce(ended_at,now()),now())-greatest(started_at,d))))*1000) from public.punch_sessions where company_id=p_company and coalesce(ended_at,now())>d),0),
 'week_gross_ms',coalesce((select sum(greatest(0,extract(epoch from (least(coalesce(ended_at,now()),now())-greatest(started_at,w))))*1000) from public.punch_sessions where company_id=p_company and coalesce(ended_at,now())>w),0),
 'pending_gps',(select count(*) from public.punch_location_checks where company_id=p_company and review_status='pending'),
 'pending_offline',(select count(*) from public.punch_event_receipts where company_id=p_company and offline and (result->>'review_status'='pending' or result->>'sync_status'='conflict')),
 'pending_corrections',(select count(*) from public.punch_correction_requests where company_id=p_company and status='pending'),
 'pending_leaves',(select count(*) from public.leave_requests where company_id=p_company and status='pending'),
 'pending_orders',(select count(*) from public.material_orders where company_id=p_company and status='requested'),
 'active_jobs',(select count(*) from public.jobs where company_id=p_company and active),
 'open_before_today',(select count(*) from public.punch_sessions where company_id=p_company and ended_at is null and started_at<d),
 'labor_cost_cents',null,'overtime_ms',null);
end $$;
revoke all on function public.company_dashboard(uuid) from public,anon;grant execute on function public.company_dashboard(uuid) to authenticated;

