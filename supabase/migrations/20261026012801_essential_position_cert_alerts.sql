-- Read-only alerts for certifications lost/expired AFTER a shift was published.
create function public.essential_position_certification_alerts(
 p_company uuid,p_start timestamptz,p_end timestamptz
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare items jsonb;truncated boolean:=false;
begin
 if not private.can_administer(p_company) or not private.essential_feature(p_company,'minimum_coverage')
 then raise exception using errcode='42501',message='Gestionnaire Essentiel Pro requis';end if;
 if p_start is null or p_end is null or p_start>=p_end
  or p_end-p_start>interval '90 days'
 then raise exception using errcode='22023',message='Période de 90 jours maximum requise';end if;
 select coalesce(jsonb_agg(to_jsonb(z) order by z.starts_at,z.shift_id),'[]'::jsonb)
 into items from (
 select s.id as shift_id,s.worker_id,s.starts_at,s.ends_at,
  p.id as position_id,p.title as position_title,p.required_certificate as certificate_title,
  l.name as location_name
 from public.scheduled_shifts s
 join public.essential_positions p on p.company_id=s.company_id and p.id=s.position_id and p.active
 join public.essential_locations l on l.company_id=s.company_id and l.id=s.location_id
 where s.company_id=p_company and s.cancelled_at is null
  and s.worker_id is not null and p.required_certificate is not null
  and s.ends_at>p_start and s.starts_at<p_end
  and not exists (
   select 1 from public.essential_certifications cert
   where cert.company_id=s.company_id and cert.worker_id=s.worker_id
    and lower(btrim(cert.title))=lower(btrim(p.required_certificate))
    and cert.issued_on <= (s.starts_at at time zone l.timezone)::date
    and (cert.expires_on is null or cert.expires_on >=
       ((s.ends_at-interval '1 microsecond') at time zone l.timezone)::date)
  )
 order by s.starts_at,s.id limit 201
 ) z;
 if jsonb_array_length(items)>200 then
  truncated:=true;
  select coalesce(jsonb_agg(v.value order by v.n),'[]'::jsonb) into items
  from jsonb_array_elements(items) with ordinality v(value,n) where v.n<=200;
 end if;
 return jsonb_build_object('items',items,'count',jsonb_array_length(items),
 'truncated',truncated,'read_only',true);
end $fn$;
revoke all on function public.essential_position_certification_alerts(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.essential_position_certification_alerts(uuid,timestamptz,timestamptz) to authenticated;
