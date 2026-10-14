-- 20261015100000 revoked the per-pax create_public_booking from anon, but the
-- database is shared with production, which still runs the per-pax form
-- until feat/agoda-booking merges. Grant it back so the live site keeps
-- taking bookings; 20261015100300 revokes it again and is applied at merge.
grant execute on function public.create_public_booking(uuid, uuid, date, text, text, text, int, text) to anon, authenticated;
