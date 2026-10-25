-- Version assigned by the remote migration service; original helper stays private.
alter policy labor_budgets_compensation on public.essential_labor_budgets using(private.essential_hr_allowed(company_id,'compensation') and private.essential_member_feature(company_id,'labor_costs'));
alter policy budget_evaluations_compensation on public.essential_budget_evaluations using(private.essential_hr_allowed(company_id,'compensation') and private.essential_member_feature(company_id,'labor_costs'));
