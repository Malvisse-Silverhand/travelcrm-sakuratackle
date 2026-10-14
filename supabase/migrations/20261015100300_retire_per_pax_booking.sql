-- Apply when feat/agoda-booking is merged (npx supabase db push): the site
-- no longer calls the per-pax create_public_booking, and leaving it callable
-- would let anyone sell seats on a boat already chartered.
revoke execute on function public.create_public_booking(uuid, uuid, date, text, text, text, int, text) from anon, authenticated;
