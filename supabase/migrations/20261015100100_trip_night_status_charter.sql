-- The operator calendar (trip_night_status) counted seats only, so a boat
-- chartered whole by a group of 8 on a 15-seat boat showed as "open" with 7
-- seats left. A live charter booking now makes the boat-night full.
-- Columns are unchanged (create or replace view cannot change them); the
-- view stays security_invoker, i.e. operator-only through bookings' RLS.

create or replace view trip_night_status with (security_invoker = true) as
select
  tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason,
  b.capacity,
  coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) as pax_held,
  case
    when tn.blocked then 'blocked'
    when bool_or(bk.pricing = 'charter' and bk.status in ('confirmed','deposit_due')) then 'full'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity then 'full'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity * 0.7 then 'selling_fast'
    else 'open'
  end as status
from trip_nights tn
join boats b on b.id = tn.boat_id
left join bookings bk on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
group by tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason, b.capacity;
