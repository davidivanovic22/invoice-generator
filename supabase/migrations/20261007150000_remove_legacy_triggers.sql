-- The JSON tables were removed by the relational migration. These trigger
-- functions have no remaining users; RESTRICT prevents removal if that changes.
begin;
drop function if exists public.paperwork_touch();
drop function if exists public.paperwork_firm_data_touch();
notify pgrst, 'reload schema';
commit;
