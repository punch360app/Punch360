-- Operational commercial controls are separate from Stripe-owned payment state.
create table private.company_service_controls (
 company_id uuid primary key references public.companies(id),suspended boolean not null default false,
 grace_days integer check(grace_days between 0 and 365),version integer not null default 1,
 updated_by uuid not null,updated_at timestamptz not null default clock_timestamp(),reason text not null check(length(trim(reason)) between 3 and 1000)
);
alter table private.company_service_controls enable row level security;
revoke all on private.company_service_controls from public,anon,authenticated;
-- Inject into the existing billing calculation, preserving signed Stripe state and contracts.
do $$
declare source text;modified text;
begin
 source:=pg_get_functiondef('private.essential_billing_state(uuid)'::regprocedure);
 modified:=replace(source,'select * into a from private.essential_billing_accounts where company_id=p_company;','if exists(select 1 from private.company_service_controls where company_id=p_company and suspended) then return ''restricted'';end if; select * into a from private.essential_billing_accounts where company_id=p_company;');
 modified:=replace(modified,'if a.paid_through is not null and a.first_unpaid_at is not null', 'select coalesce((select grace_days from private.company_service_controls where company_id=p_company),days) into days; if a.paid_through is not null and a.first_unpaid_at is not null');
 if modified=source or position('company_service_controls' in modified)=0 then raise exception 'Billing state source changed';end if;execute modified;
 source:=pg_get_functiondef('public.platform_company_detail(uuid,text)'::regprocedure);
 modified:=replace(source,'insert into private.platform_audit', 'result:=result||jsonb_build_object(''effective_billing_status'',case when c.product_edition=''essential'' then private.essential_billing_state(c.id) else c.billing_status end,''service_controls'',case when c.product_edition=''essential'' then coalesce((select jsonb_build_object(''suspended'',suspended,''grace_days'',grace_days,''version'',version,''updated_at'',updated_at) from private.company_service_controls where company_id=c.id),jsonb_build_object(''suspended'',false,''grace_days'',null,''version'',0)) else null end); insert into private.platform_audit');
 if modified=source then raise exception 'Company detail source changed';end if;execute modified;
end $$;
create function public.platform_set_company_service(p_company uuid,p_suspended boolean,p_grace_days integer,p_expected_version integer,p_confirmation text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.company_service_controls;result private.company_service_controls;company public.companies;
begin
 perform private.assert_platform_owner();
 if p_confirmation is distinct from p_company::text or length(trim(coalesce(p_reason,''))) not between 3 and 1000 or p_suspended is null then raise exception 'Confirmer l’identifiant exact de l’entreprise et un motif';end if;
 select * into company from public.companies where id=p_company for update;
 if not found or company.product_edition<>'essential' then raise exception 'Contrôles réservés aux entreprises Essentiel; Construction préservé';end if;
 select * into old from private.company_service_controls where company_id=p_company for update;
 if coalesce(old.version,0) is distinct from p_expected_version then raise exception 'Contrôles modifiés : rouvrir la fiche avant de recommencer';end if;
 insert into private.company_service_controls(company_id,suspended,grace_days,updated_by,reason) values(p_company,p_suspended,p_grace_days,auth.uid(),trim(p_reason)) on conflict(company_id) do update set suspended=excluded.suspended,grace_days=excluded.grace_days,version=company_service_controls.version+1,updated_by=excluded.updated_by,updated_at=clock_timestamp(),reason=excluded.reason returning * into result;
 insert into private.platform_audit(actor_id,action,entity_id,detail) values(auth.uid(),'company_service_controls_changed',p_company,jsonb_build_object('reason',trim(p_reason),'previous',jsonb_build_object('suspended',coalesce(old.suspended,false),'grace_days',old.grace_days,'version',coalesce(old.version,0)),'current',jsonb_build_object('suspended',result.suspended,'grace_days',result.grace_days,'version',result.version),'effective_status',private.essential_billing_state(p_company),'preserves_employee_punch',true));
 return jsonb_build_object('suspended',result.suspended,'grace_days',result.grace_days,'version',result.version,'effective_status',private.essential_billing_state(p_company));
end $$;
revoke all on function public.platform_set_company_service(uuid,boolean,integer,integer,text,text) from public,anon;
grant execute on function public.platform_set_company_service(uuid,boolean,integer,integer,text,text) to authenticated;
