-- Harden the two public booking functions.
--
-- 1. create_public_booking trusted its caller completely. It is granted to
--    anon, so anyone holding the public key could insert a booking for a past
--    night, a blocked night, a night outside the season, an inactive boat, or
--    more people than the boat holds; the website only prevented that in the
--    browser. It now checks all of it server-side, and locks the boat's night
--    row while it does, so two customers submitting at the same moment cannot
--    both take the last seats.
--
--    The reference was 'CS-YYMM-' plus 3 random digits with no retry: two
--    bookings in the same month had a 1-in-1000 chance of colliding with the
--    UNIQUE constraint and the customer just saw "tidak berjaya". It now
--    retries, and falls back to a longer suffix.
--
-- 2. get_public_availability compared against current_date, which is UTC on
--    Supabase: from midnight to 8am Malaysia time it still offered the night
--    that had already sailed. It now uses Asia/Kuala_Lumpur's date, and only
--    returns nights inside the published package's season (set in Settings),
--    so moving the season takes nights outside it off sale everywhere.
--
-- Error messages are stable strings the website maps to customer copy
-- (components/public/BookingExperience.tsx).

create or replace function public.create_public_booking(
  p_package_id uuid, p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text
) returns table (ref text) language plpgsql security definer set search_path = public as $$
declare
  v_pkg packages%rowtype;
  v_capacity int;
  v_held int;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ref text;
  v_try int := 0;
begin
  select * into v_pkg from packages where id = p_package_id and published;
  if not found then
    raise exception 'package not available';
  end if;

  if p_night_date is null or p_night_date < v_today then
    raise exception 'night has passed';
  end if;
  if (v_pkg.season_start is not null and p_night_date < v_pkg.season_start)
     or (v_pkg.season_end is not null and p_night_date > v_pkg.season_end) then
    raise exception 'night outside the season';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid name';
  end if;
  if char_length(v_phone) < 9 or char_length(v_phone) > 15 then
    raise exception 'invalid phone';
  end if;
  if char_length(coalesce(v_email, '')) > 254 or char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'field too long';
  end if;
  if p_pax is null or p_pax < 1 then
    raise exception 'invalid group size';
  end if;

  select b.capacity into v_capacity from boats b where b.id = p_boat_id and b.active;
  if not found then
    raise exception 'boat not available';
  end if;

  -- Lock this boat's night until the transaction ends: a concurrent booking
  -- for the same night waits here and then sees this one's seats as taken.
  perform 1 from trip_nights tn
  where tn.boat_id = p_boat_id and tn.night_date = p_night_date and not tn.blocked
  for update;
  if not found then
    raise exception 'night not on sale';
  end if;

  -- Same rule as get_public_availability: confirmed and deposit_due bookings
  -- hold seats; pending ones do not until the operator confirms them.
  select coalesce(sum(bk.pax), 0) into v_held
  from bookings bk
  where bk.boat_id = p_boat_id
    and bk.night_date = p_night_date
    and bk.status in ('confirmed', 'deposit_due');
  if v_held + p_pax > v_capacity then
    raise exception 'not enough seats';
  end if;

  loop
    v_ref := 'CS-' || to_char(p_night_date, 'YYMM') || '-'
             || lpad(floor(random() * 1000)::int::text, 3, '0');
    exit when not exists (select 1 from bookings b where b.ref = v_ref);
    v_try := v_try + 1;
    if v_try >= 25 then
      v_ref := 'CS-' || to_char(p_night_date, 'YYMM') || '-'
               || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit;
    end if;
  end loop;

  insert into bookings (ref, package_id, boat_id, night_date, full_name, phone, email, pax, note,
                        price_per_pax, deposit_amount)
  values (v_ref, p_package_id, p_boat_id, p_night_date, v_name, v_phone, v_email, p_pax, v_note,
          v_pkg.price_per_pax, v_pkg.deposit_per_boat);

  return query select v_ref;
end;
$$;
revoke all on function public.create_public_booking from public;
grant execute on function public.create_public_booking to anon, authenticated;

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
  with today as (
    select (now() at time zone 'Asia/Kuala_Lumpur')::date as d
  ),
  season as (
    select
      coalesce(min(season_start), '-infinity'::date) as s,
      coalesce(max(season_end), 'infinity'::date) as e
    from packages
    where published
  ),
  per_boat as (
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
    cross join season
    left join bookings bk
      on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
    where tn.night_date between p_from and p_to
      and tn.night_date between season.s and season.e
      -- A request spanning years is either a bug or abuse; answer with nothing.
      and p_to - p_from <= 800
    group by tn.night_date, tn.boat_id, b.code, b.capacity, tn.blocked
  ),
  best as (
    select distinct on (night_date) night_date, boat_id, boat_code
    from per_boat, today
    where not blocked and seats_left >= p_pax and night_date >= today.d
    order by night_date, seats_left asc, boat_code asc
  ),
  agg as (
    select
      night_date,
      count(*) filter (
        where not blocked and seats_left >= p_pax and night_date >= today.d
      ) as fitting_count,
      coalesce(sum(seats_left) filter (where not blocked), 0) as seats_left_total,
      coalesce(sum(capacity) filter (where not blocked), 0) as capacity_total
    from per_boat, today
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
