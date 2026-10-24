alter table public.punch_breaks add column is_paid boolean not null default false;
create table private.essential_paid_break_receipts (
 company_id uuid not null,user_id uuid not null,event_id uuid not null,break_id uuid not null references public.punch_breaks(id),primary key(company_id,user_id,event_id)
);
alter table private.essential_paid_break_receipts enable row level security;
revoke all on private.essential_paid_break_receipts from public,anon,authenticated;
create function public.sync_paid_break_start(p_event uuid,p_company uuid,p_occurred_at timestamptz,p_offline boolean,p_previous uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_field_punch(p_company);
 if not exists(select 1 from public.companies where id=p_company and product_edition='essential') then raise exception 'Édition Essentiel requise';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||auth.uid()::text,0));
 if exists(select 1 from public.punch_event_receipts where company_id=p_company and user_id=auth.uid() and event_id=p_event) and not exists(select 1 from private.essential_paid_break_receipts where company_id=p_company and user_id=auth.uid() and event_id=p_event) then raise exception 'Cet identifiant appartient à une autre opération';end if;
 result:=public.sync_break_event(p_event,p_company,'break_start',p_occurred_at,p_offline,p_previous);
 if result->>'sync_status'='synced' then
 update public.punch_breaks set is_paid=true where id=(result->>'break_id')::uuid and company_id=p_company and user_id=auth.uid();
 update public.punch_event_receipts r set result=r.result||jsonb_build_object('is_paid',true) where r.company_id=p_company and r.user_id=auth.uid() and r.event_id=p_event;
 insert into private.essential_paid_break_receipts(company_id,user_id,event_id,break_id) values(p_company,auth.uid(),p_event,(result->>'break_id')::uuid) on conflict do nothing;
 end if;return result||jsonb_build_object('is_paid',true);
end $$;
revoke all on function public.sync_paid_break_start(uuid,uuid,timestamptz,boolean,uuid) from public,anon;
grant execute on function public.sync_paid_break_start(uuid,uuid,timestamptz,boolean,uuid) to authenticated;
-- Same device token, PIN, session lock and idempotency checks for paid kiosk breaks.
do $$
declare definition text;changed text;
begin
 select pg_get_functiondef('public.kiosk_execute(uuid,text,text,text,text,uuid,text)'::regprocedure) into definition;
 changed:=replace(definition,'''break_start'',''break_end''','''break_start'',''break_start_paid'',''break_end''');
 changed:=replace(changed,'elsif p_action=''break_start'' then','elsif p_action in (''break_start'',''break_start_paid'') then');
 changed:=replace(changed,'insert into public.punch_breaks(company_id,session_id,user_id,started_at) values(d.company_id,s.id,w.auth_user_id,now_at);','insert into public.punch_breaks(company_id,session_id,user_id,started_at,is_paid) values(d.company_id,s.id,w.auth_user_id,now_at,p_action=''break_start_paid'');');
 if changed=definition or position('started_at,is_paid' in changed)=0 then raise exception 'Kiosk source changed; paid break migration requires review';end if;execute changed;
end $$;
create table public.essential_pay_rules (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),version integer not null,
 effective_week date not null check(extract(isodow from effective_week)=1),timezone text not null,
 overtime_hours numeric(7,2) not null check(overtime_hours between 0 and 168),overtime_multiplier numeric(5,3) not null check(overtime_multiplier between 1 and 5),
 premiums jsonb not null default '[]' check(jsonb_typeof(premiums)='array' and jsonb_array_length(premiums)<=12),validation_note text not null check(length(trim(validation_note)) between 10 and 2000),
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),unique(company_id,version)
);
create index pay_rules_week on public.essential_pay_rules(company_id,effective_week desc,version desc);
create table public.essential_pay_rates (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),worker_id uuid not null,effective_on date not null,hourly_cents integer not null check(hourly_cents between 0 and 10000000),
 created_by uuid not null,created_at timestamptz not null default clock_timestamp(),reason text not null check(length(trim(reason)) between 3 and 1000),foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create index pay_rates_worker on public.essential_pay_rates(company_id,worker_id,effective_on desc,created_at desc);
create table public.essential_pay_credits (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),worker_id uuid not null,on_date date not null,kind text not null check(kind in ('holiday','vacation','other')),
 counted_hours numeric(7,2) not null check(counted_hours between 0 and 24),amount_cents bigint not null check(amount_cents between 0 and 100000000),reason text not null check(length(trim(reason)) between 3 and 1000),created_by uuid not null,created_at timestamptz not null default now(),
 request_id uuid not null,unique(company_id,request_id),foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create table public.essential_bank_entries (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),worker_id uuid not null,kind text not null check(kind in ('time','vacation')),
 minutes integer not null check(minutes<>0 and abs(minutes)<=1000000),reason text not null check(length(trim(reason)) between 3 and 2000),evidence text not null check(length(trim(evidence)) between 3 and 2000),
 request_id uuid not null,created_by uuid not null,created_at timestamptz not null default clock_timestamp(),unique(company_id,request_id),foreign key(company_id,worker_id) references public.company_workers(company_id,id)
);
create index bank_entries_worker on public.essential_bank_entries(company_id,worker_id,kind);
create table public.essential_payroll_estimates (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),week_start date not null,payload jsonb not null,created_by uuid not null,created_at timestamptz not null default clock_timestamp()
);
create index payroll_estimates_week on public.essential_payroll_estimates(company_id,week_start desc);
alter table public.essential_pay_rules enable row level security;
alter table public.essential_pay_rates enable row level security;
alter table public.essential_pay_credits enable row level security;
alter table public.essential_bank_entries enable row level security;
alter table public.essential_payroll_estimates enable row level security;
create policy pay_rules_read on public.essential_pay_rules for select to authenticated using(private.essential_hr_allowed(company_id,'compensation'));
create policy pay_rates_read on public.essential_pay_rates for select to authenticated using(private.essential_hr_allowed(company_id,'compensation'));
create policy pay_credits_read on public.essential_pay_credits for select to authenticated using(private.essential_hr_allowed(company_id,'compensation'));
create policy estimates_read on public.essential_payroll_estimates for select to authenticated using(private.essential_hr_allowed(company_id,'compensation'));
create policy bank_entries_read on public.essential_bank_entries for select to authenticated using(private.essential_hr_allowed(company_id,'compensation') or exists(select 1 from public.company_workers w where w.company_id=essential_bank_entries.company_id and w.id=worker_id and w.auth_user_id=(select auth.uid()) and w.personal_access and w.status='active' and private.is_member(w.company_id)));
grant select on public.essential_pay_rules,public.essential_pay_rates,public.essential_pay_credits,public.essential_bank_entries,public.essential_payroll_estimates to authenticated;
revoke insert,update,delete on public.essential_pay_rules,public.essential_pay_rates,public.essential_pay_credits,public.essential_bank_entries,public.essential_payroll_estimates from anon,authenticated;
create function private.essential_assert_compensation(p_company uuid,p_mutation boolean default true) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not private.essential_hr_allowed(p_company,'compensation') or not private.essential_feature(p_company,'advanced_reports') or (p_mutation and not private.can_administer(p_company)) then raise exception using errcode='42501',message='Permission Rémunération et forfait Pro requis';end if;
end $$;
revoke all on function private.essential_assert_compensation(uuid,boolean) from public,anon,authenticated;
create function public.save_essential_pay_rule(p_company uuid,p_expected_version integer,p_week date,p_timezone text,p_threshold numeric,p_multiplier numeric,p_premiums jsonb,p_validation text) returns uuid language plpgsql security definer set search_path='' as $$
declare v integer;r uuid;premium jsonb;
begin
 perform private.essential_assert_compensation(p_company);perform 1 from public.companies where id=p_company for update;
 select coalesce(max(version),0) into v from public.essential_pay_rules where company_id=p_company;if v is distinct from p_expected_version then raise exception 'Règles modifiées, actualisez';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Fuseau IANA invalide';end if;
 if p_premiums is null or jsonb_typeof(p_premiums)<>'array' or jsonb_array_length(p_premiums)>12 then raise exception 'Primes invalides';end if;
 for premium in select value from jsonb_array_elements(p_premiums) loop
 if jsonb_typeof(premium)<>'object' or exists(select 1 from jsonb_object_keys(premium) k where k not in ('name','cents','start','end')) or length(trim(coalesce(premium->>'name','')))<2 or (premium->>'cents') is null or (premium->>'cents')::integer not between 0 and 100000 or (premium->>'start') is null or (premium->>'end') is null or (premium->>'start')::time=(premium->>'end')::time then raise exception 'Prime : nom, cents/heure et plage horaire requis';end if;
 end loop;
 insert into public.essential_pay_rules(company_id,version,effective_week,timezone,overtime_hours,overtime_multiplier,premiums,validation_note,created_by) values(p_company,v+1,p_week,p_timezone,p_threshold,p_multiplier,p_premiums,p_validation,auth.uid()) returning id into r;return r;
end $$;
create function public.add_essential_pay_rate(p_company uuid,p_worker uuid,p_effective date,p_cents integer,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.essential_assert_compensation(p_company);perform 1 from public.companies where id=p_company for update;
 insert into public.essential_pay_rates(company_id,worker_id,effective_on,hourly_cents,reason,created_by) values(p_company,p_worker,p_effective,p_cents,p_reason,auth.uid()) returning id into result;return result;
end $$;
create function public.add_essential_pay_credit(p_company uuid,p_worker uuid,p_date date,p_kind text,p_hours numeric,p_amount bigint,p_reason text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;old public.essential_pay_credits;
begin
 perform private.essential_assert_compensation(p_company);perform pg_advisory_xact_lock(hashtextextended('pay-credit:'||p_company::text||p_request::text,0));
 select * into old from public.essential_pay_credits where company_id=p_company and request_id=p_request;
 if found then if old.worker_id is distinct from p_worker or old.on_date is distinct from p_date or old.kind is distinct from p_kind or old.counted_hours is distinct from p_hours or old.amount_cents is distinct from p_amount or old.reason is distinct from p_reason or old.created_by is distinct from auth.uid() then raise exception 'Identifiant de crédit réutilisé';end if;return old.id;end if;
 insert into public.essential_pay_credits(company_id,worker_id,on_date,kind,counted_hours,amount_cents,reason,request_id,created_by) values(p_company,p_worker,p_date,p_kind,p_hours,p_amount,p_reason,p_request,auth.uid()) returning id into result;return result;
end $$;
create function public.add_essential_bank_entry(p_company uuid,p_worker uuid,p_kind text,p_minutes integer,p_reason text,p_evidence text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;old public.essential_bank_entries;balance bigint;
begin
 perform private.essential_assert_compensation(p_company);
 if exists(select 1 from public.company_workers where company_id=p_company and id=p_worker and auth_user_id=auth.uid()) then raise exception 'Un autre responsable autorisé doit ajuster votre propre banque';end if;
 perform pg_advisory_xact_lock(hashtextextended('bank:'||p_company::text||p_worker::text,0));
 select * into old from public.essential_bank_entries where company_id=p_company and request_id=p_request;
 if found then if old.worker_id is distinct from p_worker or old.kind is distinct from p_kind or old.minutes is distinct from p_minutes or old.reason is distinct from p_reason or old.evidence is distinct from p_evidence or old.created_by is distinct from auth.uid() then raise exception 'Identifiant de mouvement réutilisé';end if;return old.id;end if;
 select coalesce(sum(minutes),0) into balance from public.essential_bank_entries where company_id=p_company and worker_id=p_worker and kind=p_kind;
 if balance+p_minutes<0 then raise exception 'Solde de banque insuffisant';end if;
 insert into public.essential_bank_entries(company_id,worker_id,kind,minutes,reason,evidence,request_id,created_by) values(p_company,p_worker,p_kind,p_minutes,p_reason,p_evidence,p_request,auth.uid()) returning id into result;return result;
end $$;
-- Real elapsed seconds, clipped once to each segment; unpaid breaks are not subtracted twice.
create function private.essential_worked_seconds(p_company uuid,p_worker uuid,p_start timestamptz,p_end timestamptz) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(greatest(0,extract(epoch from least(g.ended_at,p_end)-greatest(g.started_at,p_start))-
 coalesce((select sum(greatest(0,extract(epoch from least(b.ended_at,g.ended_at,p_end)-greatest(b.started_at,g.started_at,p_start)))) from public.punch_breaks b where b.session_id=s.id and not b.is_paid),0))),0)
 from public.punch_segments g join public.punch_sessions s on s.id=g.session_id and s.company_id=g.company_id where s.company_id=p_company and s.worker_id=p_worker and s.ended_at is not null and g.ended_at is not null and g.started_at<p_end and g.ended_at>p_start
$$;
revoke all on function private.essential_worked_seconds(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
create index essential_closed_sessions_worker on public.punch_sessions(company_id,worker_id,started_at) where ended_at is not null;
create function public.generate_essential_payroll_estimate(p_company uuid,p_week date) returns public.essential_payroll_estimates language plpgsql security definer set search_path='' as $$
declare rule public.essential_pay_rules;w record;rate public.essential_pay_rates;outcome public.essential_payroll_estimates;rows jsonb:='[]';result jsonb;prem jsonb;start_at timestamptz;end_at timestamptz;ds timestamptz;de timestamptz;ps timestamptz;pe timestamptz;day date;idx integer;paid numeric;total_seconds numeric;regular_remaining numeric;regular numeric;ot numeric;ot_total numeric;wage numeric;premium_cents numeric;credits_hours numeric;credits_amount bigint;missing boolean;open_punch boolean;week_closed boolean;rate_ids uuid[];
begin
 perform private.essential_assert_compensation(p_company,false);
 if p_week is null or extract(isodow from p_week)<>1 then raise exception 'Lundi de semaine requis';end if;
 select * into rule from public.essential_pay_rules where company_id=p_company and effective_week<=p_week order by effective_week desc,version desc limit 1;
 if not found then raise exception 'Configurer et vérifier les règles de rémunération avant le rapport';end if;
 start_at:=p_week::timestamp at time zone rule.timezone;end_at:=(p_week+7)::timestamp at time zone rule.timezone;
 perform 1 from public.payroll_weeks where company_id=p_company and week_start=p_week and reopened_at is null for share;week_closed:=found;
 if (select count(*) from public.company_workers where company_id=p_company)>1000 then raise exception 'Rapport limité à 1000 dossiers; utiliser un export par période/périmètre adapté';end if;
 for w in select id,employee_number,first_name,last_name,department_id,location_id from public.company_workers cw where cw.company_id=p_company and (cw.status='active' or exists(select 1 from public.punch_sessions where company_id=p_company and worker_id=cw.id and started_at<end_at and ended_at>start_at)) order by employee_number loop
 select coalesce(sum(counted_hours),0),coalesce(sum(amount_cents),0) into credits_hours,credits_amount from public.essential_pay_credits where company_id=p_company and worker_id=w.id and on_date>=p_week and on_date<p_week+7;
 regular_remaining:=greatest(0,rule.overtime_hours-credits_hours)*3600;wage:=0;ot_total:=0;total_seconds:=0;premium_cents:=0;missing:=false;rate_ids:='{}';
 for idx in 0..6 loop
 day:=p_week+idx;ds:=day::timestamp at time zone rule.timezone;de:=(day+1)::timestamp at time zone rule.timezone;paid:=private.essential_worked_seconds(p_company,w.id,ds,de);total_seconds:=total_seconds+paid;
 select * into rate from public.essential_pay_rates where company_id=p_company and worker_id=w.id and effective_on<=day order by effective_on desc,created_at desc,id desc limit 1;
 if not found and paid>0 then missing:=true;end if;
 regular:=least(paid,regular_remaining);ot:=paid-regular;regular_remaining:=greatest(0,regular_remaining-regular);ot_total:=ot_total+ot;
 if paid>0 and rate.id is not null then wage:=wage+(regular+ot*rule.overtime_multiplier)*rate.hourly_cents/3600;rate_ids:=array_append(rate_ids,rate.id);end if;
 end loop;
 for prem in select value from jsonb_array_elements(rule.premiums) loop
 for idx in -1..6 loop
 day:=p_week+idx;ps:=private.essential_local_instant(day+(prem->>'start')::time,rule.timezone);pe:=private.essential_local_instant((day+case when (prem->>'end')::time<(prem->>'start')::time then 1 else 0 end)+(prem->>'end')::time,rule.timezone);
 premium_cents:=premium_cents+private.essential_worked_seconds(p_company,w.id,greatest(ps,start_at),least(pe,end_at))*(prem->>'cents')::numeric/3600;
 end loop;end loop;
 select exists(select 1 from public.punch_sessions where company_id=p_company and worker_id=w.id and ended_at is null and started_at<end_at) into open_punch;
 rows:=rows||jsonb_build_array(jsonb_build_object('worker_id',w.id,'employee_number',w.employee_number,'name',w.first_name||' '||w.last_name,'department_id',w.department_id,'location_id',w.location_id,'paid_seconds',total_seconds,'overtime_seconds',ot_total,'credited_hours',credits_hours,'credit_amount_cents',credits_amount,'base_and_overtime_cents',case when missing then null else round(wage) end,'premium_cents',round(premium_cents),'estimated_cents',case when missing then null else round(wage+premium_cents)+credits_amount end,'missing_rate',missing,'open_punch',open_punch,'rate_ids',to_jsonb(rate_ids)));
 end loop;
 result:=jsonb_build_object('estimate_only',true,'legal_certified',false,'week',p_week,'timezone',rule.timezone,'rule_id',rule.id,'rule_version',rule.version,'validation_note',rule.validation_note,'week_closed',week_closed,'rows',rows,'generated_at',clock_timestamp(),'notice','Estimation brute avant retenues, charges, indemnités non saisies et validation des règles applicables. Les primes configurées s’additionnent; elles ne sont pas majorées au taux supplémentaire. Aucune heure officielle n’est modifiée.');
 insert into public.essential_payroll_estimates(company_id,week_start,payload,created_by) values(p_company,p_week,result,auth.uid()) returning * into outcome;return outcome;
end $$;
revoke all on function public.save_essential_pay_rule(uuid,integer,date,text,numeric,numeric,jsonb,text),public.add_essential_pay_rate(uuid,uuid,date,integer,text),public.add_essential_pay_credit(uuid,uuid,date,text,numeric,bigint,text,uuid),public.add_essential_bank_entry(uuid,uuid,text,integer,text,text,uuid),public.generate_essential_payroll_estimate(uuid,date) from public,anon;
grant execute on function public.save_essential_pay_rule(uuid,integer,date,text,numeric,numeric,jsonb,text),public.add_essential_pay_rate(uuid,uuid,date,integer,text),public.add_essential_pay_credit(uuid,uuid,date,text,numeric,bigint,text,uuid),public.add_essential_bank_entry(uuid,uuid,text,integer,text,text,uuid),public.generate_essential_payroll_estimate(uuid,date) to authenticated;
-- Aggregate under the caller's RLS, without silently truncating a long ledger.
create function public.essential_bank_balances(p_company uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (select worker_id,kind,sum(minutes)::bigint as balance_minutes from public.essential_bank_entries where company_id=p_company group by worker_id,kind)x
$$;
revoke all on function public.essential_bank_balances(uuid) from public,anon;
grant execute on function public.essential_bank_balances(uuid) to authenticated;
create index pay_credits_worker_date on public.essential_pay_credits(company_id,worker_id,on_date);
