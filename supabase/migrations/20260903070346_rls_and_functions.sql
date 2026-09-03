alter table boats enable row level security;
alter table trip_nights enable row level security;
alter table packages enable row level security;
alter table bookings enable row level security;
alter table booking_pax enable row level security;
alter table org_settings enable row level security;
alter table profiles enable row level security;

-- Helper: is the current request from a signed-in operator?
create or replace function public.is_operator() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

-- ===== PROFILES =====
create policy "read own profile" on profiles for select using (id = auth.uid());
-- Inserts happen via Supabase Auth Admin API (invite flow) using the service role key
-- from a server route — no client INSERT policy needed.

-- ===== BOATS (public needs to see fleet codes/capacity for the calendar; only
-- operator can manage the fleet) =====
create policy "boats readable by anyone" on boats for select using (true);
create policy "boats managed by operator" on boats for all using (is_operator()) with check (is_operator());

-- ===== TRIP_NIGHTS (public needs availability; only operator blocks nights) =====
create policy "trip_nights readable by anyone" on trip_nights for select using (true);
create policy "trip_nights managed by operator" on trip_nights for all using (is_operator()) with check (is_operator());
-- trip_night_status is a plain view over these two tables' SELECT policies — no
-- separate RLS needed on the view itself.

-- ===== PACKAGES (public sees published packages; operator manages) =====
create policy "published packages readable by anyone" on packages for select using (published = true);
create policy "operator reads all packages" on packages for select using (is_operator());
create policy "packages managed by operator" on packages for insert with check (is_operator());
create policy "packages updated by operator" on packages for update using (is_operator());
create policy "packages deleted by operator" on packages for delete using (is_operator());

-- ===== ORG_SETTINGS (whatsapp number etc. needed by the public page; only operator writes) =====
create policy "org_settings readable by anyone" on org_settings for select using (true);
create policy "org_settings managed by operator" on org_settings for update using (is_operator());

-- ===== BOOKINGS: no direct anon INSERT or SELECT policy at all. =====
-- Operator gets full access via RLS. The public form and "check my booking" feature
-- go through SECURITY DEFINER functions instead, which run with elevated privilege
-- but only expose exactly the fields/rows they're designed to.
create policy "bookings full access for operator" on bookings for all using (is_operator()) with check (is_operator());

-- ===== BOOKING_PAX (operator only — not needed by the public flow) =====
create policy "booking_pax managed by operator" on booking_pax for all using (is_operator()) with check (is_operator());

-- ===== PUBLIC-FACING FUNCTIONS (replace anon table access) =====

-- 1. Create a booking (public form submit). Server-controls status/deposit fields —
--    the caller cannot set them directly.
create or replace function public.create_public_booking(
  p_package_id uuid, p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text
) returns table (ref text) language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_deposit numeric; v_ref text;
begin
  select price_per_pax, deposit_per_boat into v_price, v_deposit
  from packages where id = p_package_id;

  v_ref := 'CS-' || to_char(p_night_date, 'YYMM') || '-' || lpad(floor(random()*999)::text, 3, '0');

  insert into bookings (ref, package_id, boat_id, night_date, full_name, phone, email, pax, note, price_per_pax, deposit_amount)
  values (v_ref, p_package_id, p_boat_id, p_night_date, p_full_name, p_phone, p_email, p_pax, p_note, v_price, v_deposit);

  return query select v_ref;
end;
$$;
revoke all on function public.create_public_booking from public;
grant execute on function public.create_public_booking to anon, authenticated;

-- 2. Check booking status by phone — returns ONLY the fields the public UI shows,
--    never email/note/other customers' rows, and only exact-match on the phone given.
create or replace function public.check_booking_by_phone(p_phone text)
returns table (ref text, boat_code text, night_date date, pax int, status booking_status, balance_due numeric)
language sql security definer stable set search_path = public as $$
  select b.ref, bt.code, b.night_date, b.pax, b.status,
         (b.price_per_pax * b.pax) - (case when b.deposit_paid then b.deposit_amount else 0 end)
  from bookings b join boats bt on bt.id = b.boat_id
  where b.phone = p_phone
  order by b.night_date desc;
$$;
revoke all on function public.check_booking_by_phone from public;
grant execute on function public.check_booking_by_phone to anon, authenticated;
