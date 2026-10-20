-- Booking actions: every step of a booking from the admin Bookings page
-- (accept, payments, balance at the jetty, weather hold, move, outcome,
-- cancel with refund). Plan: ~/.claude/plans/i-need-some-suggestions-bright-bonbon.md
--
-- trip_outcome is its own column, not a booking_status value: revenue,
-- availability and reports filter on status, and a new status would drop
-- completed trips out of them.

alter table bookings
  add column if not exists accepted_at timestamptz,
  add column if not exists balance_paid boolean not null default false,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists trip_outcome text check (trip_outcome in ('completed', 'no_show')),
  add column if not exists outcome_at timestamptz,
  add column if not exists cancel_reason text check (char_length(cancel_reason) <= 500),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references profiles(id) on delete set null,
  add column if not exists refund_amount numeric(10,2) check (refund_amount >= 0),
  add column if not exists refunded_at timestamptz;

-- Move a booking to another night, boat or group size. Same night-taken
-- check and row lock as admin_create_booking; the agreed total stays.
create or replace function public.admin_move_booking(
  p_id uuid, p_night_date date, p_boat_id uuid, p_pax int
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_bk bookings%rowtype;
  v_boat boats%rowtype;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_status booking_status;
begin
  if not private.is_operator() then
    raise exception 'not allowed';
  end if;

  select * into v_bk from bookings where id = p_id for update;
  if not found then
    raise exception 'booking not found';
  end if;
  if v_bk.status = 'cancelled' then
    raise exception 'booking cancelled';
  end if;
  if p_night_date is null or p_night_date < v_today then
    raise exception 'night has passed';
  end if;

  select * into v_boat from boats where id = p_boat_id and active;
  if not found then
    raise exception 'boat not available';
  end if;
  if p_pax is null or p_pax < 1 or p_pax > v_boat.capacity then
    raise exception 'invalid group size';
  end if;

  insert into trip_nights (boat_id, night_date) values (p_boat_id, p_night_date)
  on conflict (boat_id, night_date) do nothing;
  perform 1 from trip_nights tn
  where tn.boat_id = p_boat_id and tn.night_date = p_night_date and not tn.blocked
  for update;
  if not found then
    raise exception 'night blocked';
  end if;

  if exists (
    select 1 from bookings bk
    where bk.boat_id = p_boat_id and bk.night_date = p_night_date and bk.id <> p_id
      and private.is_live_hold(bk.status, bk.deposit_paid, bk.receipt_url, bk.created_at)
  ) then
    raise exception 'night taken';
  end if;

  -- A weather-held trip that gets a new night is back on.
  v_status := case
    when v_bk.status = 'weather_hold' then (case when v_bk.deposit_paid then 'confirmed' else 'deposit_due' end)::booking_status
    else v_bk.status
  end;

  update bookings
  set night_date = p_night_date, boat_id = p_boat_id, pax = p_pax,
      -- Charters keep the agreed total; old per-pax bookings re-total by trigger.
      price_per_pax = case when pricing = 'charter' then round(total_amount / p_pax, 2) else price_per_pax end,
      status = v_status,
      trip_outcome = null, outcome_at = null, updated_at = now()
  where id = p_id;

  return v_bk.ref;
end;
$$;

revoke all on function public.admin_move_booking(uuid, date, uuid, int) from public, anon;
grant execute on function public.admin_move_booking(uuid, date, uuid, int) to authenticated;

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
  if new.balance_paid is distinct from old.balance_paid then
    v_changes := v_changes || case when new.balance_paid then 'balance collected' else 'balance unmarked' end;
  end if;
  if new.trip_outcome is distinct from old.trip_outcome then
    v_changes := v_changes || case new.trip_outcome when 'completed' then 'trip completed' when 'no_show' then 'no-show' else 'outcome cleared' end;
  end if;
  if new.refund_amount is distinct from old.refund_amount and coalesce(new.refund_amount, 0) > 0 then
    v_changes := v_changes || format('refund RM%s due', new.refund_amount);
  end if;
  if new.refunded_at is distinct from old.refunded_at and new.refunded_at is not null then
    v_changes := v_changes || 'refund paid'::text;
  end if;
  if new.cancel_reason is distinct from old.cancel_reason and new.cancel_reason is not null then
    v_changes := v_changes || format('reason: %s', left(new.cancel_reason, 120));
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
