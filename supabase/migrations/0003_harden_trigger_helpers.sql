-- Harden the app-owned trigger-only helper functions.
-- These are invoked by database triggers, not exposed as client RPC endpoints.
-- Pin search_path to built-ins only and revoke direct execution from client roles.
ALTER FUNCTION public.touch_updated_at() SET search_path = pg_catalog;
ALTER FUNCTION public.check_link_ownership() SET search_path = pg_catalog;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_link_ownership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
