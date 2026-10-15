-- Phase A (trust) and boat jetties.
--
-- 1. Jetties: where a boat sails from. The homepage search lists these and
--    shows only the boats of the jetty picked. Seeded with the four the
--    design shows; Marang is the only one open. Every boat starts at Marang.
--
-- 2. Unpaid holds expire. A pending booking with no payment and no receipt
--    stops holding its boat-night after org_settings.hold_hours (default 48,
--    editable in Settings): get_boat_availability ignores it at once, and
--    expire_unpaid_holds() cancels it (run by the daily cron and before every
--    new booking), which the bell shows as "Booking expired".
--
-- 3. check_booking(ref, phone) replaces check_booking_by_phone for the public
--    "Check My Booking": a phone number alone no longer reveals bookings.
--    The old function is revoked in 20261015120100, applied at merge, because
--    the live site still calls it until then.

-- ===== 1. Jetties ===========================================================
create table if not exists jetties (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  subtitle text not null default '',
  lat numeric(8,5) not null check (lat between -90 and 90),
  lng numeric(8,5) not null check (lng between -180 and 180),
  open boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table jetties enable row level security;
create policy "anyone reads jetties" on jetties for select using (true);
create policy "admin manages jetties" on jetties
  for all using (private.is_operator()) with check (private.is_operator());

insert into jetties (id, name, subtitle, lat, lng, open, sort_order) values
  ('marang', 'Marang', 'Jeti Marang, Terengganu', 5.2066, 103.2058, true, 1),
  ('kt', 'Kuala Terengganu', 'Akan dibuka', 5.3302, 103.1408, false, 2),
  ('dungun', 'Dungun', 'Akan dibuka', 4.7566, 103.415, false, 3),
  ('besut', 'Besut', 'Akan dibuka', 5.8306, 102.5583, false, 4)
on conflict (id) do nothing;

alter table boats add column if not exists jetty_id text not null default 'marang'
  references jetties(id) on update cascade;

-- Fleet changes in the activity log include the jetty.
create or replace function private.trg_boats_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform private.log_activity('boat.created', 'boat', new.id::text, format('Boat %s added', new.code));
    return new;
  end if;
  if new.code is distinct from old.code then v_changes := v_changes || format('code %s → %s', old.code, new.code); end if;
  if new.active is distinct from old.active then v_changes := v_changes || case when new.active then 'activated' else 'deactivated' end; end if;
  if new.capacity is distinct from old.capacity then v_changes := v_changes || format('capacity %s → %s', old.capacity, new.capacity); end if;
  if new.daily_rate is distinct from old.daily_rate then v_changes := v_changes || format('rate %s → %s', old.daily_rate, new.daily_rate); end if;
  if new.photo_url is distinct from old.photo_url then v_changes := v_changes || 'photo changed'::text; end if;
  if new.skipper_name is distinct from old.skipper_name then v_changes := v_changes || format('skipper %s', new.skipper_name); end if;
  if new.vendor_id is distinct from old.vendor_id then v_changes := v_changes || 'vendor changed'::text; end if;
  if new.jetty_id is distinct from old.jetty_id then v_changes := v_changes || format('jetty %s → %s', old.jetty_id, new.jetty_id); end if;
  if array_length(v_changes, 1) > 0 then
    perform private.log_activity('boat.updated', 'boat', new.id::text,
      format('%s: %s', new.code, array_to_string(v_changes, ', ')));
  end if;
  return new;
end;
$$;

-- ===== 2. Hold expiry =======================================================
alter table org_settings add column if not exists hold_hours int not null default 48;
alter table org_settings drop constraint if exists org_settings_hold_hours_check;
alter table org_settings add constraint org_settings_hold_hours_check check (hold_hours between 1 and 720);

create or replace function private.hold_cutoff() returns timestamptz
language sql stable security definer set search_path = public as $$
  select now() - make_interval(hours => coalesce((select hold_hours from org_settings where id = 1), 48))
$$;

-- True while a booking still holds its boat-night.
create or replace function private.is_live_hold(p_status booking_status, p_paid boolean, p_receipt text, p_created timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select p_status in ('confirmed', 'deposit_due', 'weather_hold')
      or (p_status = 'pending' and (p_paid or p_receipt is not null or p_created >= private.hold_cutoff()))
$$;

create or replace function private.expire_unpaid_holds() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  -- Tells the bookings trigger to log these as expiries, not cancellations.
  perform set_config('app.expiring', '1', true);
  with gone as (
    update bookings set status = 'cancelled', updated_at = now()
    where status = 'pending' and not deposit_paid and receipt_url is null
      and created_at < private.hold_cutoff()
    returning 1
  )
  select count(*) into v_n from gone;
  perform set_config('app.expiring', '', true);
  return v_n;
end;
$$;

-- For the cron route (service role only).
create or replace function public.expire_unpaid_holds() returns int
language sql security definer set search_path = public as $$
  select private.expire_unpaid_holds()
$$;
revoke all on function public.expire_unpaid_holds() from public, anon, authenticated;
grant execute on function public.expire_unpaid_holds() to service_role;

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
      when bool_or(bk.status = 'pending'
                   and private.is_live_hold(bk.status, bk.deposit_paid, bk.receipt_url, bk.created_at)) then 'held'
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
    and p_to - p_from <= 800
  group by tn.boat_id, tn.night_date, tn.blocked
  order by tn.night_date, tn.boat_id
$$;
revoke all on function public.get_boat_availability from public;
grant execute on function public.get_boat_availability to anon, authenticated;

-- Charter booking: expires stale holds first, and refuses boats whose jetty
-- is not open yet.
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
  perform private.expire_unpaid_holds();

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

  select b.* into v_boat from boats b join jetties j on j.id = b.jetty_id and j.open
  where b.id = p_boat_id and b.active;
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

-- The bookings trigger names expiries (from the latest version in
-- 20261015110000; only the action choice changes).
create or replace function private.trg_bookings_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes text[] := '{}';
  v_others text;
  v_boat text;
begin
  select code into v_boat from boats where id = new.boat_id;

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

  if current_setting('app.expiring', true) = '1' and new.status = 'cancelled' and old.status <> 'cancelled' then
    perform private.log_activity('booking.expired', 'booking', new.id::text,
      format('%s (%s): unpaid hold expired, night %s on %s released', new.ref, new.full_name, to_char(new.night_date, 'DD Mon YYYY'), coalesce(v_boat, 'boat')),
      jsonb_build_object('ref', new.ref));
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

-- ===== 3. Booking lookup by reference + phone ===============================
create or replace function public.check_booking(p_ref text, p_phone text)
returns table (ref text, boat_code text, night_date date, pax int, status booking_status, balance_due numeric)
language sql security definer stable set search_path = public as $$
  -- The reference proves the phone belongs to the caller; then every booking
  -- on that phone is shown, as before.
  with owner as (
    select b.phone from bookings b
    where upper(b.ref) = upper(btrim(coalesce(p_ref, '')))
      and b.phone = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    limit 1
  )
  select b.ref, bt.code, b.night_date, b.pax, b.status,
         greatest(0, b.total_amount - case
           when not b.deposit_paid then 0
           when b.pay_plan = 'full' then b.total_amount
           else b.deposit_amount
         end)
  from bookings b
  join boats bt on bt.id = b.boat_id
  join owner o on o.phone = b.phone
  order by b.night_date desc;
$$;
revoke all on function public.check_booking from public;
grant execute on function public.check_booking to anon, authenticated;
