-- Whole-boat charter booking (the Agoda-style booking flow).
--
-- Until now a booking bought seats: total = pax x price_per_pax, and several
-- groups could share one boat-night. The new flow books the whole boat for the
-- night at the boat's daily_rate, whatever the group size, the way the
-- operator actually sells trips. Existing bookings keep their per-pax pricing;
-- `pricing` says which model a row uses.
--
-- 1. bookings gains
--      pricing       'per_pax' | 'charter'
--      total_amount  what the customer owes in all. A trigger keeps it equal
--                    to pax x price_per_pax for per-pax rows, so admin edits
--                    of pax cannot leave it stale; charter rows keep the rate
--                    they were booked at.
--      pay_plan      'deposit' | 'full': what the customer chose to pay up
--                    front. deposit_paid then means "the up-front payment was
--                    received", whichever plan it was.
--
-- 2. get_boat_availability: one row per boat per night, for the per-boat
--    calendar. A boat-night is
--      full     blocked by the operator, or held by a confirmed / deposit-due /
--               weather-hold booking (any pricing model: a seat sold on the
--               old model still means the boat sails with that group);
--      held     a pending booking is waiting for its payment;
--      open     otherwise.
--    Pending bookings hold the boat. Under charter, letting a second group
--    book a night someone has just booked would only end in one of them being
--    turned away. The operator cancels a pending booking that never pays,
--    which frees the night.
--
-- 3. create_charter_booking: the only public way to book from now on. It
--    validates everything server-side, locks the boat-night row, and refuses
--    a night any live booking already holds.
--
-- 4. create_public_booking (per-pax) is no longer granted to anon: the new
--    flow does not call it, and leaving it callable would let anyone sell
--    seats on a boat already chartered.
--
-- 5. check_booking_by_phone returns a balance that respects both models and
--    the payment plan.

-- ===== 1. Columns ===========================================================
alter table bookings
  add column if not exists pricing text not null default 'per_pax',
  add column if not exists total_amount numeric(10,2),
  add column if not exists pay_plan text not null default 'deposit';

alter table bookings drop constraint if exists bookings_pricing_check;
alter table bookings add constraint bookings_pricing_check check (pricing in ('per_pax', 'charter'));
alter table bookings drop constraint if exists bookings_pay_plan_check;
alter table bookings add constraint bookings_pay_plan_check check (pay_plan in ('deposit', 'full'));

update bookings set total_amount = pax * price_per_pax where total_amount is null;

create or replace function private.trg_bookings_total() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.pricing = 'per_pax' or new.total_amount is null then
    new.total_amount := new.pax * new.price_per_pax;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_total on bookings;
create trigger bookings_total before insert or update on bookings
  for each row execute function private.trg_bookings_total();

alter table bookings alter column total_amount set not null;

-- ===== 2. Per-boat availability =============================================
create or replace function public.get_boat_availability(
  p_from date, p_to date, p_boat_id uuid default null
)
returns table (boat_id uuid, night_date date, status text)
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
  )
  select
    tn.boat_id,
    tn.night_date,
    case
      when tn.blocked then 'full'
      when bool_or(bk.status in ('confirmed', 'deposit_due', 'weather_hold')) then 'full'
      when bool_or(bk.status = 'pending') then 'held'
      else 'open'
    end as status
  from trip_nights tn
  join boats b on b.id = tn.boat_id and b.active
  cross join today
  cross join season
  left join bookings bk
    on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date and bk.status <> 'cancelled'
  where tn.night_date between p_from and p_to
    and tn.night_date between season.s and season.e
    and tn.night_date >= today.d
    and (p_boat_id is null or tn.boat_id = p_boat_id)
    -- A request spanning years is either a bug or abuse; answer with nothing.
    and p_to - p_from <= 800
  group by tn.boat_id, tn.night_date, tn.blocked
  order by tn.night_date, tn.boat_id
$$;
revoke all on function public.get_boat_availability from public;
grant execute on function public.get_boat_availability to anon, authenticated;

-- ===== 3. Charter booking ===================================================
-- Error messages are stable strings the website maps to customer copy
-- (components/public/book/Checkout.tsx).
create or replace function public.create_charter_booking(
  p_package_id uuid, p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text,
  p_pay_plan text
) returns table (ref text, total_amount numeric, deposit_amount numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_pkg packages%rowtype;
  v_boat boats%rowtype;
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
  if coalesce(p_pay_plan, '') not in ('deposit', 'full') then
    raise exception 'invalid payment plan';
  end if;

  select * into v_boat from boats b where b.id = p_boat_id and b.active;
  if not found or v_boat.daily_rate is null or v_boat.daily_rate <= 0 then
    raise exception 'boat not available';
  end if;
  if p_pax is null or p_pax < 1 or p_pax > v_boat.capacity then
    raise exception 'invalid group size';
  end if;

  -- Lock this boat's night until the transaction ends: a concurrent booking
  -- for the same night waits here, then sees this one and is refused.
  perform 1 from trip_nights tn
  where tn.boat_id = p_boat_id and tn.night_date = p_night_date and not tn.blocked
  for update;
  if not found then
    raise exception 'night not on sale';
  end if;

  -- Same rule as get_boat_availability: any live booking holds the boat.
  if exists (
    select 1 from bookings bk
    where bk.boat_id = p_boat_id and bk.night_date = p_night_date and bk.status <> 'cancelled'
  ) then
    raise exception 'night taken';
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

  -- price_per_pax is still required by the table; for a charter it records
  -- the effective per-head price, which is informative and keeps any old
  -- pax x price_per_pax arithmetic close to the truth.
  insert into bookings (ref, package_id, boat_id, night_date, full_name, phone, email, pax, note,
                        pricing, price_per_pax, total_amount, deposit_amount, pay_plan)
  values (v_ref, p_package_id, p_boat_id, p_night_date, v_name, v_phone, v_email, p_pax, v_note,
          'charter', round(v_boat.daily_rate / p_pax, 2), v_boat.daily_rate,
          least(v_pkg.deposit_per_boat, v_boat.daily_rate), p_pay_plan);

  return query select v_ref, v_boat.daily_rate, least(v_pkg.deposit_per_boat, v_boat.daily_rate);
end;
$$;
revoke all on function public.create_charter_booking from public;
grant execute on function public.create_charter_booking to anon, authenticated;

-- ===== 4. Retire the per-pax public booking =================================
revoke execute on function public.create_public_booking(uuid, uuid, date, text, text, text, int, text) from anon, authenticated;

-- ===== 5. Balance that knows the model and the plan =========================
create or replace function public.check_booking_by_phone(p_phone text)
returns table (ref text, boat_code text, night_date date, pax int, status booking_status, balance_due numeric)
language sql security definer stable set search_path = public as $$
  select b.ref, bt.code, b.night_date, b.pax, b.status,
         greatest(0, b.total_amount - case
           when not b.deposit_paid then 0
           when b.pay_plan = 'full' then b.total_amount
           else b.deposit_amount
         end)
  from bookings b join boats bt on bt.id = b.boat_id
  where b.phone = p_phone
  order by b.night_date desc;
$$;
revoke all on function public.check_booking_by_phone from public;
grant execute on function public.check_booking_by_phone to anon, authenticated;
