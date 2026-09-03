-- Deposit receipt photos (§1: "File storage: Supabase Storage (deposit
-- receipt photos)"). Private bucket — receipts carry financial + customer
-- info, so only operators may read/write, same as bookings itself.
-- Storage upsert needs INSERT + SELECT + UPDATE (granting only INSERT would
-- let uploads through but silently fail on file replacement), so this uses
-- `for all` rather than a narrower single-operation policy.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "operator manages receipts"
on storage.objects for all
using (bucket_id = 'receipts' and private.is_operator())
with check (bucket_id = 'receipts' and private.is_operator());
