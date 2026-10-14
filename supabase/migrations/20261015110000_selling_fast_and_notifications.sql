-- 1. "Selling Fast" nights stay bookable.
--    A pending booking (waiting for its payment) no longer blocks the
--    boat-night: Mal would rather take a second group and turn one away than
--    lose the night to a group that never pays. Only a confirmed, deposit-due
--    or weather-hold booking makes the night full. get_boat_availability is
--    unchanged: it still reports such a night as 'held', which the website
--    labels "Selling Fast" and now lets customers pick.
--
-- 2. Notifications for the admin bell come from activity_log, with clearer
--    actions written by the bookings trigger:
--      booking.created    new booking
--      booking.conflict   a boat-night now has more than one live booking
--                         (someone has to be turned away)
--      receipt.uploaded   a customer sent a payment receipt
--      booking.cancelled  a booking was cancelled
--    Each admin's "seen up to" time lives in admin_notification_state.

-- ===== 1. Charter booking: pending does not block ===========================
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

  perform 1 from trip_nights tn
  where tn.boat_id = p_boat_id and tn.night_date = p_night_date and not tn.blocked
  for update;
  if not found then
    raise exception 'night not on sale';
  end if;

  -- Same rule as get_boat_availability's 'full'. Pending bookings do not
  -- count: the night stays on sale until someone's payment is confirmed.
  if exists (
    select 1 from bookings bk
    where bk.boat_id = p_boat_id and bk.night_date = p_night_date
      and bk.status in ('confirmed', 'deposit_due', 'weather_hold')
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

-- ===== 2. Notification-grade activity ========================================
create or replace function private.trg_bookings_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes text[] := '{}';
  v_others text;
  v_boat text;
begin
  select code into v_boat from boats where id = new.boat_id;

  -- Other live bookings on the same boat-night (charter sells the whole boat).
  select string_agg(b.ref || ' (' || b.full_name || ', ' || b.status || ')', ', ')
    into v_others
  from bookings b
  where b.boat_id = new.boat_id and b.night_date = new.night_date
    and b.id <> new.id and b.status <> 'cancelled';

  if tg_op = 'INSERT' then
    perform private.log_activity('booking.created', 'booking', new.id::text,
      format('%s booked %s for %s pax (%s)', new.full_name, to_char(new.night_date, 'DD Mon YYYY'), new.pax, new.ref),
      jsonb_build_object('ref', new.ref));
    if v_others is not null then
      perform private.log_activity('booking.conflict', 'booking', new.id::text,
        format('Double booking: %s on %s, %s also booked by %s', new.ref, to_char(new.night_date, 'DD Mon YYYY'), coalesce(v_boat, 'boat'), v_others),
        jsonb_build_object('ref', new.ref));
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    v_changes := v_changes || format('status %s → %s', old.status, new.status);
  end if;
  if new.deposit_paid is distinct from old.deposit_paid then
    v_changes := v_changes || case when new.deposit_paid then 'payment received' else 'payment unmarked' end;
  end if;
  if new.boat_id is distinct from old.boat_id then
    v_changes := v_changes || 'boat changed'::text;
  end if;
  if new.night_date is distinct from old.night_date then
    v_changes := v_changes || format('night %s → %s', old.night_date, new.night_date);
  end if;
  if new.pax is distinct from old.pax then
    v_changes := v_changes || format('pax %s → %s', old.pax, new.pax);
  end if;
  if new.receipt_url is distinct from old.receipt_url and new.receipt_url is not null then
    v_changes := v_changes || 'receipt uploaded'::text;
  end if;

  if array_length(v_changes, 1) > 0 then
    perform private.log_activity(
      case
        when new.status = 'cancelled' and old.status <> 'cancelled' then 'booking.cancelled'
        when new.deposit_paid and not old.deposit_paid then 'payment.verified'
        when new.receipt_url is distinct from old.receipt_url and new.receipt_url is not null then 'receipt.uploaded'
        else 'booking.updated'
      end,
      'booking', new.id::text,
      format('%s (%s): %s', new.ref, new.full_name, array_to_string(v_changes, ', ')),
      jsonb_build_object('ref', new.ref));
  end if;

  -- Confirming one booking, or moving it, onto a boat-night someone else
  -- also holds: the other group has to be told.
  if v_others is not null and new.status <> 'cancelled'
     and (new.status is distinct from old.status
          or new.boat_id is distinct from old.boat_id
          or new.night_date is distinct from old.night_date) then
    perform private.log_activity('booking.conflict', 'booking', new.id::text,
      format('Double booking: %s (%s) on %s, %s also booked by %s', new.ref, new.status, to_char(new.night_date, 'DD Mon YYYY'), coalesce(v_boat, 'boat'), v_others),
      jsonb_build_object('ref', new.ref));
  end if;
  return new;
end;
$$;

-- ===== 3. Per-admin "seen up to" ============================================
create table if not exists admin_notification_state (
  user_id uuid primary key references profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table admin_notification_state enable row level security;
create policy "admin manages own notification state" on admin_notification_state
  for all using (user_id = auth.uid() and private.is_operator())
  with check (user_id = auth.uid() and private.is_operator());
