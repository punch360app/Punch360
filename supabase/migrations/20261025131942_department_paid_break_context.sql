-- This guard is private and transaction-bound; client-set GUCs are never trusted.
create table private.essential_paid_break_context(tx bigint primary key,company_id uuid not null,user_id uuid not null);
alter table private.essential_paid_break_context enable row level security;
revoke all on private.essential_paid_break_context from public,anon,authenticated;
do $migration$
declare source text;changed text;
begin
 source:=pg_get_functiondef('public.sync_paid_break_start(uuid,uuid,timestamptz,boolean,uuid)'::regprocedure);
 changed:=replace(source,$old$ result:=public.sync_break_event(p_event,p_company,'break_start',p_occurred_at,p_offline,p_previous);$old$,$new$ insert into private.essential_paid_break_context values(txid_current(),p_company,auth.uid());
 result:=public.sync_break_event(p_event,p_company,'break_start',p_occurred_at,p_offline,p_previous);
 delete from private.essential_paid_break_context where tx=txid_current();$new$);
 if changed=source then raise exception 'Paid break source changed: inspect before migration';end if;execute changed;
 source:=pg_get_functiondef('private.enforce_department_break_policy()'::regprocedure);
 changed:=replace(source,$old$ p:=private.department_break_policy(s.company_id,w.id,new.started_at);$old$,$new$ if exists(select 1 from private.essential_paid_break_context where tx=txid_current() and company_id=s.company_id and user_id=auth.uid() and user_id=s.user_id) then new.is_paid:=true;end if;
 p:=private.department_break_policy(s.company_id,w.id,new.started_at);$new$);
 if changed=source then raise exception 'Policy trigger source changed: inspect before migration';end if;execute changed;
end $migration$;
