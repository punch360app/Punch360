-- Boss handoff history must never prevent Supabase Auth user deletion.
-- The company-scoped workforce audit remains the durable security record.
alter table private.essential_boss_handoffs
 drop constraint essential_boss_handoffs_from_user_fkey,
 drop constraint essential_boss_handoffs_to_user_fkey,
 add constraint essential_boss_handoffs_from_user_fkey foreign key(from_user) references auth.users(id) on delete cascade,
 add constraint essential_boss_handoffs_to_user_fkey foreign key(to_user) references auth.users(id) on delete cascade;
