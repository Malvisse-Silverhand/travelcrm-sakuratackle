-- Page builder: a role for a marketing helper who builds website pages but
-- must not see bookings, customers or money. Added on its own because
-- Postgres cannot use a new enum value in the transaction that adds it; the
-- policies that use it are in the next migration.
alter type operator_role add value if not exists 'editor';
