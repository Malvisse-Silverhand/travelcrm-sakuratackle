-- The calendar now sells two seasons (Mac–September 2026 and Mac–September
-- 2027), and the v2 fleet added three boats that have no trip_nights at all.
-- This fills both gaps in one pass.
--
-- Runs after 20260918100000_fleet_v2_specs so that:
--   * the three new boats exist and get nights for both seasons
--   * BTL 07 / PKR 1180 are already inactive and are skipped
--
-- `on conflict do nothing` against the (boat_id, night_date) unique key makes
-- this idempotent and leaves the existing 2027 rows untouched, including any
-- an operator has already blocked.

insert into trip_nights (boat_id, night_date)
select b.id, d::date
from boats b
cross join (
  select generate_series('2026-03-01'::date, '2026-09-30'::date, '1 day') as d
  union all
  select generate_series('2027-03-01'::date, '2027-09-30'::date, '1 day')
) nights
where b.active
on conflict (boat_id, night_date) do nothing;

-- Most of the 2026 range is already in the past. Those rows are harmless —
-- get_public_availability reports any night before current_date as 'full'
-- (see 20260903092504_hide_past_nights), so they can never be booked; they
-- exist so the operator console can show a complete season history.
