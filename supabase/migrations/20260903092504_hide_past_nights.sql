-- The public calendar must never offer a night that has already passed. Once the
-- season is underway, `get_public_availability` would otherwise keep returning
-- earlier nights as 'open' (nothing booked on them) and let someone submit a
-- booking for a date in the past. Past nights now come back as 'full' with no
-- suggested boat, so the existing UI greys them out without any client change.
--
-- The operator console is unaffected: it reads trip_night_status directly, and
-- still needs to see history.

create or replace function public.get_public_availability(
  p_from date, p_to date, p_pax int default 1
)
returns table (
  night_date date,
  status text,
  suggested_boat_id uuid,
  suggested_boat_code text
)
language sql security definer stable set search_path = public as $$
  with per_boat as (
    select
      tn.night_date,
      tn.boat_id,
      b.code as boat_code,
      b.capacity,
      tn.blocked,
      b.capacity - coalesce(
        sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0
      ) as seats_left
    from trip_nights tn
    join boats b on b.id = tn.boat_id and b.active
    left join bookings bk
      on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
    where tn.night_date between p_from and p_to
    group by tn.night_date, tn.boat_id, b.code, b.capacity, tn.blocked
  ),
  best as (
    select distinct on (night_date) night_date, boat_id, boat_code
    from per_boat
    where not blocked and seats_left >= p_pax and night_date >= current_date
    order by night_date, seats_left asc, boat_code asc
  ),
  agg as (
    select
      night_date,
      count(*) filter (
        where not blocked and seats_left >= p_pax and night_date >= current_date
      ) as fitting_count,
      coalesce(sum(seats_left) filter (where not blocked), 0) as seats_left_total,
      coalesce(sum(capacity) filter (where not blocked), 0) as capacity_total
    from per_boat
    group by night_date
  )
  select
    a.night_date,
    case
      when a.fitting_count = 0 then 'full'
      when a.fitting_count = 1 then 'selling_fast'
      when a.seats_left_total <= 0.3 * a.capacity_total then 'selling_fast'
      else 'open'
    end as status,
    b.boat_id as suggested_boat_id,
    b.boat_code as suggested_boat_code
  from agg a
  left join best b on b.night_date = a.night_date
  order by a.night_date
$$;
revoke all on function public.get_public_availability from public;
grant execute on function public.get_public_availability to anon, authenticated;
