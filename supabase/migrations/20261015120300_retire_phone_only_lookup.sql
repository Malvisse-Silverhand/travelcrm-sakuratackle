-- Apply when feat/phase-a-trust is merged: the site then uses check_booking
-- (reference + phone), and a phone number alone must no longer list bookings.
revoke execute on function public.check_booking_by_phone(text) from anon, authenticated;
