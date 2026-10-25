create index essential_invoice_accounting_date on private.essential_stripe_invoices((coalesce(paid_at,period_end,updated_at)),id);
create function public.platform_finance_report(p_from date,p_until date,p_company uuid default null,p_test boolean default false,p_before timestamptz default null,p_before_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_live_platform_session();
 if p_from is null or p_until is null or p_from>p_until or p_until-p_from>3660 or p_test is null or ((p_before is null)<>(p_before_id is null)) then raise exception 'Intervalle de rapport invalide';end if;
 with filtered as materialized (
  select i.id,i.company_id,c.name as company_name,i.status,i.total_cents,i.paid_cents,i.currency,i.period_end,i.paid_at,coalesce(i.paid_at,i.period_end,i.updated_at) as accounting_at
  from private.essential_stripe_invoices i join public.companies c on c.id=i.company_id
  where c.is_test=p_test and (p_company is null or i.company_id=p_company)
  and coalesce(i.paid_at,i.period_end,i.updated_at)>=(p_from::timestamp at time zone 'America/Toronto')
  and coalesce(i.paid_at,i.period_end,i.updated_at)<((p_until+1)::timestamp at time zone 'America/Toronto')
 ), page as (select * from filtered where p_before is null or (accounting_at,id)<(p_before,p_before_id) order by accounting_at desc,id desc limit 101)
 select jsonb_build_object('from',p_from,'until',p_until,'timezone','America/Toronto','test',p_test,
 'totals',(select jsonb_build_object('invoices',count(*),'total_cents',coalesce(sum(total_cents) filter(where status<>'void'),0),'paid_cents',coalesce(sum(paid_cents),0),'open_count',count(*) filter(where status='open'),'uncollectible_count',count(*) filter(where status='uncollectible'),'void_count',count(*) filter(where status='void')) from filtered),
 'months',coalesce((select jsonb_agg(to_jsonb(m) order by m.month) from (select to_char(accounting_at at time zone 'America/Toronto','YYYY-MM') as month,count(*) as invoices,coalesce(sum(total_cents) filter(where status<>'void'),0) as total_cents,coalesce(sum(paid_cents),0) as paid_cents from filtered group by 1)m),'[]'::jsonb),
 'invoices',coalesce((select jsonb_agg(to_jsonb(p) order by p.accounting_at desc,p.id desc) from (select * from page order by accounting_at desc,id desc limit 100)p),'[]'::jsonb),
 'has_more',(select count(*)>100 from page)) into result;
 return result;
end $$;
revoke all on function public.platform_finance_report(date,date,uuid,boolean,timestamptz,text) from public,anon;
grant execute on function public.platform_finance_report(date,date,uuid,boolean,timestamptz,text) to authenticated;
