-- Security advisor: public.rls_auto_enable() is a SECURITY DEFINER event
-- trigger function (Supabase's "enable RLS on new tables", event trigger
-- ensure_rls) that was callable by anon and authenticated over the API.
-- Event triggers run without EXECUTE grants, so revoking them keeps the
-- trigger working and closes the endpoint.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
