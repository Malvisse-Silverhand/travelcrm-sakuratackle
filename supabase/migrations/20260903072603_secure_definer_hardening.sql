-- Fixes two findings from `supabase db advisors --type security`:
--
-- 1. ERROR: trip_night_status was a SECURITY DEFINER view (Postgres default),
--    meaning it ran with the view owner's privileges rather than the querying
--    role's — so any role able to SELECT it (including anon) could read
--    aggregated booking data across ALL customers, bypassing bookings' RLS
--    (which intentionally has zero anon policies). Fix: flip the view to
--    SECURITY INVOKER (correct for the operator console, which already has
--    full RLS access to the underlying tables) and add a narrow SECURITY
--    DEFINER function for the public calendar that exposes status only
--    (open/selling_fast/full/blocked), never raw pax counts — same pattern
--    as create_public_booking / check_booking_by_phone in the prior migration.
--
-- 2. WARN: is_operator() lived in `public`, so PostgREST auto-exposed it as
--    a callable RPC endpoint for anon/authenticated. It's harmless to call
--    directly (returns a boolean derived from the caller's own auth.uid()),
--    but it's only meant to be used inside RLS policies, not as a public API.
--    Fix: move it to a `private` schema, which PostgREST does not expose.

alter view trip_night_status set (security_invoker = true);

create schema if not exists private;

create or replace function private.is_operator() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;
grant execute on function private.is_operator() to anon, authenticated;

-- Re-point every policy that referenced public.is_operator() at the new
-- private.is_operator(), then drop the old public one.
drop policy "boats managed by operator" on boats;
create policy "boats managed by operator" on boats for all using (private.is_operator()) with check (private.is_operator());

drop policy "trip_nights managed by operator" on trip_nights;
create policy "trip_nights managed by operator" on trip_nights for all using (private.is_operator()) with check (private.is_operator());

drop policy "operator reads all packages" on packages;
create policy "operator reads all packages" on packages for select using (private.is_operator());

drop policy "packages managed by operator" on packages;
create policy "packages managed by operator" on packages for insert with check (private.is_operator());

drop policy "packages updated by operator" on packages;
create policy "packages updated by operator" on packages for update using (private.is_operator());

drop policy "packages deleted by operator" on packages;
create policy "packages deleted by operator" on packages for delete using (private.is_operator());

drop policy "org_settings managed by operator" on org_settings;
create policy "org_settings managed by operator" on org_settings for update using (private.is_operator());

drop policy "bookings full access for operator" on bookings;
create policy "bookings full access for operator" on bookings for all using (private.is_operator()) with check (private.is_operator());

drop policy "booking_pax managed by operator" on booking_pax;
create policy "booking_pax managed by operator" on booking_pax for all using (private.is_operator()) with check (private.is_operator());

drop function public.is_operator();

-- Public-facing derived availability (status only, no pax counts) — the
-- public booking page's calendar should call this instead of selecting
-- trip_night_status directly, since that view is now operator-only (invoker).
create or replace function public.get_public_availability(p_from date, p_to date)
returns table (boat_id uuid, boat_code text, night_date date, status text)
language sql security definer stable set search_path = public as $$
  select tn.boat_id, b.code, tn.night_date,
    case
      when tn.blocked then 'blocked'
      when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity then 'full'
      when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity * 0.7 then 'selling_fast'
      else 'open'
    end as status
  from trip_nights tn
  join boats b on b.id = tn.boat_id
  left join bookings bk on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
  where tn.night_date between p_from and p_to
  group by tn.boat_id, b.code, tn.night_date, tn.blocked, b.capacity
$$;
revoke all on function public.get_public_availability from public;
grant execute on function public.get_public_availability to anon, authenticated;
