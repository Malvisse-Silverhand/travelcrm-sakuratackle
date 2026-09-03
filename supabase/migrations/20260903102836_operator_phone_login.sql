-- Lets an operator sign in with phone OR email without any SMS provider.
-- Supabase's native phone+password auth requires an SMS provider configured
-- project-wide (Twilio etc.) just to mark the "phone" identity type as
-- enabled — real third-party infra and per-message cost, for what is really
-- just a login convenience for a single operator. Instead: phone is a lookup
-- field on `profiles`, resolved server-side to the underlying email, which
-- then goes through Supabase's normal (already-working) email+password auth.
-- The operator sets/changes their own phone number from Settings (Screen 10).

alter table profiles add column phone text unique;

-- Same shape as check_booking_by_phone: a narrow SECURITY DEFINER function
-- that returns the one field the login form needs (an email to hand to
-- signInWithPassword) and nothing else — never the full profile row. Only
-- matches active operators, same as is_operator()'s own check.
--
-- Rate-limiting note (same caveat as check_booking_by_phone): this is a
-- phone-number lookup callable by anyone with the anon key. Low risk at
-- single-operator scale; revisit with an Edge Function rate limit if the
-- operator roster grows.
create or replace function public.resolve_operator_login(p_identifier text)
returns text
language sql security definer stable set search_path = public as $$
  select email from profiles
  where is_active and phone = p_identifier
  limit 1
$$;
revoke all on function public.resolve_operator_login from public;
grant execute on function public.resolve_operator_login to anon, authenticated;
