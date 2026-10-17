-- Admin "New booking": bookings that did not come through the website
-- (WhatsApp, phone, walk-in) are keyed in from /admin/bookings/new.
--
-- 1. bookings.source says where a booking came from; created_by says which
--    admin or vendor keyed it in (null for website bookings).
-- 2. admin_create_booking() does the same night-taken check as the website,
--    under the same row lock, but lets staff set an agreed price and the
--    payment state. Admins may book any active boat; vendors only their own.
--    A night with no trip_nights row (outside the season) is opened for it.
--    Only 'pending' bookings expire like website holds; the other payment
--    states hold the night until staff change them.

alter table bookings
  add column if not exists source text not null default 'website'
    check (source in ('website', 'whatsapp', 'phone', 'walk_in', 'other')),
  add column if not exists created_by uuid references profiles(id) on delete set null;

create or replace function public.admin_create_booking(
  p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text,
  p_source text, p_payment text, p_total numeric
) returns table (id uuid, ref text)
language plpgsql security definer set search_path = public as $$
declare
  v_pkg packages%rowtype;
  v_boat boats%rowtype;
  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_total numeric;
  v_status booking_status;
  v_paid boolean := false;
  v_plan text := 'deposit';
  v_id uuid;
  v_ref text;
  v_try int := 0;
begin
  if not (private.is_operator() or private.is_vendor_of(p_boat_id)) then
    raise exception 'not allowed';
  end if;

  perform private.expire_unpaid_holds();

  select * into v_pkg from packages where published order by created_at limit 1;
  if not found then
    raise exception 'package not available';
  end if;

  if p_night_date is null or p_night_date < v_today then
    raise exception 'night has passed';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid name';
  end if;
  if char_length(v_phone) < 9 or char_length(v_phone) > 15 then
    raise exception 'invalid phone';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'invalid email';
  end if;
  if char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'field too long';
  end if;
  if coalesce(p_source, '') not in ('whatsapp', 'phone', 'walk_in', 'other') then
    raise exception 'invalid source';
  end if;

  case coalesce(p_payment, '')
    when 'pending' then v_status := 'pending';
    when 'deposit_due' then v_status := 'deposit_due';
    when 'deposit_paid' then v_status := 'confirmed'; v_paid := true;
    when 'paid_full' then v_status := 'confirmed'; v_paid := true; v_plan := 'full';
    else raise exception 'invalid payment state';
  end case;

  select * into v_boat from boats where boats.id = p_boat_id and active;
  if not found then
    raise exception 'boat not available';
  end if;
  if p_pax is null or p_pax < 1 or p_pax > v_boat.capacity then
    raise exception 'invalid group size';
  end if;

  v_total := coalesce(nullif(p_total, 0), v_boat.daily_rate);
  if v_total is null or v_total <= 0 or v_total > 100000 then
    raise exception 'invalid price';
  end if;

  -- Open the night if it is not on the calendar yet, then lock it.
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
    where bk.boat_id = p_boat_id and bk.night_date = p_night_date
      and private.is_live_hold(bk.status, bk.deposit_paid, bk.receipt_url, bk.created_at)
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
                        pricing, price_per_pax, total_amount, deposit_amount, pay_plan,
                        status, deposit_paid, deposit_paid_at, source, created_by)
  values (v_ref, v_pkg.id, p_boat_id, p_night_date, v_name, v_phone, v_email, p_pax, v_note,
          'charter', round(v_total / p_pax, 2), v_total, least(v_pkg.deposit_per_boat, v_total), v_plan,
          v_status, v_paid, case when v_paid then now() end, p_source, auth.uid())
  returning bookings.id into v_id;

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.admin_create_booking(uuid, date, text, text, text, int, text, text, text, numeric) from public, anon;
grant execute on function public.admin_create_booking(uuid, date, text, text, text, int, text, text, text, numeric) to authenticated;
