-- Supabase query name: Refresh API Schema Cache
-- Read-access schema refresh only. No cases or roles are changed.
notify pgrst, 'reload schema';
