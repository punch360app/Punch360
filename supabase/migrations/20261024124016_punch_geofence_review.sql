alter table public.jobs add column punch_radius_m integer not null default 200 check(punch_radius_m between 10 and 10000);
grant update(punch_radius_m) on public.jobs to authenticated;
create table public.punch_location_checks (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, session_id uuid not null, job_id uuid not null,
 user_id uuid not null, action text not null check(action in ('in','out','transfer')),
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 accuracy_m double precision check(accuracy_m>=0 and accuracy_m<1000000), distance_m double precision,
 radius_m integer not null, job_latitude double precision, job_longitude double precision,
 location_status text not null check(location_status in ('inside','outside','missing','inaccurate','job_unconfigured')),
 review_status text not null check(review_status in ('automatic','pending','accepted','corrected')),
 recorded_at timestamptz not null default clock_timestamp(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id), review_note text,
 foreign key(company_id,session_id) references public.punch_sessions(company_id,id),
 foreign key(company_id,job_id) references public.jobs(company_id,id),
 foreign key(company_id,user_id) references public.company_members(company_id,user_id)
);
create index location_checks_pending on public.punch_location_checks(company_id,review_status,recorded_at);
alter table public.punch_location_checks enable row level security;
create policy location_read on public.punch_location_checks for select to authenticated
 using(private.is_member(company_id) and (user_id=auth.uid() or private.is_manager(company_id)));
grant select on public.punch_location_checks to authenticated;
create table public.app_notifications (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, recipient_id uuid not null,
 kind text not null, title text not null, body text not null, location_check_id uuid references public.punch_location_checks(id),
 created_at timestamptz not null default clock_timestamp(), read_at timestamptz,
 foreign key(company_id,recipient_id) references public.company_members(company_id,user_id)
);
create index notifications_recipient on public.app_notifications(recipient_id,created_at desc);
alter table public.app_notifications enable row level security;
create policy notification_read on public.app_notifications for select to authenticated
 using(recipient_id=auth.uid() and private.is_member(company_id));
create policy notification_update on public.app_notifications for update to authenticated
 using(recipient_id=auth.uid() and private.is_member(company_id)) with check(recipient_id=auth.uid() and private.is_member(company_id));
grant select on public.app_notifications to authenticated;
grant update(read_at) on public.app_notifications to authenticated;

create function public.punch_with_location(p_company uuid,p_action text,p_job uuid default null,
 p_latitude double precision default null,p_longitude double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session uuid; v_job uuid; j public.jobs; v_distance double precision; v_status text; v_check uuid; v_angle double precision;
begin
 if auth.uid() is null or not private.is_member(p_company) then raise exception 'Accès refusé'; end if;
 if p_action is null or p_action not in ('in','out','transfer') then raise exception 'Action invalide'; end if;
 if (p_latitude is null)<>(p_longitude is null) or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
 or p_accuracy<0 or p_accuracy>=1000000 or p_latitude::text in ('NaN','Infinity','-Infinity')
 or p_longitude::text in ('NaN','Infinity','-Infinity') or p_accuracy::text in ('NaN','Infinity','-Infinity') then raise exception 'Coordonnées invalides'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company::text||auth.uid()::text,0));
 if p_action='out' then
  select ps.job_id into v_job from public.punch_segments ps join public.punch_sessions s on s.id=ps.session_id
   where s.company_id=p_company and s.user_id=auth.uid() and s.ended_at is null and ps.ended_at is null;
  v_session:=public.punch_out(p_company);
 elsif p_action='in' then v_job:=p_job;v_session:=public.punch_in(p_company,p_job);
 else v_job:=p_job;v_session:=public.punch_transfer(p_company,p_job);
 end if;
 select * into j from public.jobs where company_id=p_company and id=v_job;
 if not found then raise exception 'Job introuvable'; end if;
 if j.latitude is null or j.longitude is null then v_status:='job_unconfigured';
 elsif p_latitude is null then v_status:='missing';
 else
  v_angle:=power(sin(radians(p_latitude-j.latitude)/2),2)+cos(radians(j.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-j.longitude)/2),2);
  v_distance:=6371000*2*asin(sqrt(least(1.0,greatest(0.0,v_angle))));
  if p_accuracy is null or p_accuracy>least(100.0,j.punch_radius_m::double precision) then v_status:='inaccurate';
  elsif v_distance>j.punch_radius_m then v_status:='outside';
  else v_status:='inside'; end if;
 end if;
 insert into public.punch_location_checks(company_id,session_id,job_id,user_id,action,latitude,longitude,accuracy_m,distance_m,radius_m,job_latitude,job_longitude,location_status,review_status)
 values(p_company,v_session,v_job,auth.uid(),p_action,p_latitude,p_longitude,p_accuracy,v_distance,j.punch_radius_m,j.latitude,j.longitude,v_status,
 case when v_status='inside' then 'automatic' else 'pending' end) returning id into v_check;
 if v_status<>'inside' then
  insert into public.app_notifications(company_id,recipient_id,kind,title,body,location_check_id)
  select p_company,m.user_id,'punch_location','Punch à valider — #'||j.number,
   case v_status when 'outside' then 'Hors rayon : '||round(v_distance)::text||' m (maximum '||j.punch_radius_m||' m).'
   when 'missing' then 'Position GPS indisponible.' when 'inaccurate' then 'Précision GPS insuffisante.'
   else 'Coordonnées du chantier à configurer.' end,v_check
  from public.company_members m where m.company_id=p_company and m.status='active' and m.role in ('boss','admin');
 end if;
 return jsonb_build_object('session_id',v_session,'check_id',v_check,'location_status',v_status,'review_status',case when v_status='inside' then 'automatic' else 'pending' end,'distance_m',v_distance,'radius_m',j.punch_radius_m);
end $$;
-- Raw punch RPCs remain internal to the secured wrapper; clients cannot bypass GPS review.
revoke execute on function public.punch_in(uuid,uuid),public.punch_out(uuid),public.punch_transfer(uuid,uuid) from authenticated;

create function public.review_punch_location(p_check uuid,p_note text,p_start timestamptz default null,p_end timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.punch_location_checks; v_request uuid;
begin
 select * into r from public.punch_location_checks where id=p_check for update;
 if not found or not private.can_administer(r.company_id) then raise exception 'Accès refusé'; end if;
 if r.user_id=auth.uid() then raise exception 'Validation de son propre punch interdite'; end if;
 if r.review_status<>'pending' or length(trim(coalesce(p_note,'')))<3 then raise exception 'Punch déjà traité ou motif manquant'; end if;
 if p_start is not null or p_end is not null then
  insert into public.punch_correction_requests(company_id,session_id,requested_by,requested_start,requested_end,reason)
   values(r.company_id,r.session_id,r.user_id,p_start,p_end,'Correction GPS : '||trim(p_note)) returning id into v_request;
  perform public.review_punch_correction(v_request,true,p_note);
 end if;
 update public.punch_location_checks set review_status=case when v_request is null then 'accepted' else 'corrected' end,
 reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_note=trim(p_note) where id=r.id;
 update public.app_notifications set read_at=clock_timestamp() where location_check_id=r.id;
 insert into public.workforce_audit(company_id,actor_id,action,entity_id,before_value,after_value,reason)
 values(r.company_id,auth.uid(),'location_review',r.id,to_jsonb(r),jsonb_build_object('correction_request',v_request),trim(p_note));
end $$;
revoke all on function public.punch_with_location(uuid,text,uuid,double precision,double precision,double precision),public.review_punch_location(uuid,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.punch_with_location(uuid,text,uuid,double precision,double precision,double precision),public.review_punch_location(uuid,text,timestamptz,timestamptz) to authenticated;
