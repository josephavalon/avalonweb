-- Server-side checkout and webhook handlers use the Supabase service/secret key
-- through the Data API. Keep customer-facing RLS intact, but make sure the
-- backend service role has the base object privileges it needs to persist and
-- reconcile appointment records.

grant usage on schema public to service_role;
grant usage on schema app_private to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on all functions in schema public to service_role;
grant execute on all functions in schema app_private to service_role;
