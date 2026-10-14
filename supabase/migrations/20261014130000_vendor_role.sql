-- Vendors: boat owners and partners who see their own boats' bookings and
-- calendar, nothing else. Added on its own because Postgres cannot use a
-- new enum value inside the transaction that adds it; the policies that
-- use it are in the next migration.
--
-- Existing accounts keep role 'operator', which from now on means admin.

alter type operator_role add value if not exists 'vendor';
