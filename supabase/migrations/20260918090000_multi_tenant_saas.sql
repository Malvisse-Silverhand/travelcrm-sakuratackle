-- ============================================================================
-- Multi-tenant SaaS conversion
-- ============================================================================
-- Until now every RLS policy meant "any active operator sees everything",
-- which is correct for one business and a data breach for two. The moment a
-- second vendor signs up, vendor B's operator would read vendor A's
-- customers, phone numbers, bookings and revenue. This migration adds a
-- vendor scope to every domain table and rewrites every policy against it.
--
-- Sequencing note: this changes RPC signatures the currently-deployed app
-- calls, so the live site breaks between this migration and the matching
-- code deploy. Acceptable here only because the season starts Mac 2027 and
-- there are zero real bookings — do not repeat this pattern once live.

-- ---------------------------------------------------------------- plans ----
-- Display-only pricing (no payment gateway — §8 defers that). Plan limits
-- are stored so the UI can show them and so enforcement can be added later
-- without another migration.
create table plans (
  code           text primary key,
  name           text not null,
  price_myr      numeric(10,2) not null,
  billing_period text not null default 'month',
  boat_limit     int,                       -- null = unlimited
  blurb          text not null default '',
  features       jsonb not null default '[]',
  sort_order     int not null default 0,
  active         boolean not null default true
);

-- Customer-facing copy is bahasa rojak (this is landing-page content).
insert into plans (code, name, price_myr, boat_limit, blurb, features, sort_order) values
  ('starter', 'Starter', 49, 1,
   'Sesuai untuk juragan yang baru start, satu bot je.',
   '["1 bot","Booking page sendiri","Tempahan tanpa had","Semak booking by phone"]'::jsonb, 1),
  ('pro', 'Pro', 129, 5,
   'Untuk operator yang dah ada beberapa bot dan nak tengok report.',
   '["Sehingga 5 bot","Semua benda dalam Starter","Report & revenue tracking","Upload resit deposit","Page builder"]'::jsonb, 2),
  ('fleet', 'Fleet', 299, null,
   'Untuk fleet besar yang jalan sepanjang musim.',
   '["Bot tanpa had","Semua benda dalam Pro","Priority support","Multi-operator (akan datang)"]'::jsonb, 3);

-- -------------------------------------------------------------- vendors ----
create type subscription_status as enum
  ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

create table vendors (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  business_name       text not null,
  location            text not null default '',
  whatsapp_number     text not null default '',
  plan_code           text references plans(code),
  subscription_status subscription_status not null default 'trialing',
  trial_ends_at       timestamptz,
  active              boolean not null default true,
  created_at          timestamptz default now()
);

-- Slugs live in URLs (/v/<slug>), so keep them predictable.
alter table vendors add constraint vendors_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40);

-- --------------------------------------------------- vendor_id everywhere ---
-- profiles.vendor_id is nullable: a pure platform admin belongs to no vendor.
-- is_platform_admin is a separate flag rather than a role enum value so the
-- same person can be both the platform owner and vendor #1's operator —
-- which is exactly the current situation.
alter table profiles    add column vendor_id uuid references vendors(id) on delete cascade;
alter table profiles    add column is_platform_admin boolean not null default false;
alter table boats       add column vendor_id uuid references vendors(id) on delete cascade;
alter table packages    add column vendor_id uuid references vendors(id) on delete cascade;
alter table trip_nights add column vendor_id uuid references vendors(id) on delete cascade;
alter table bookings    add column vendor_id uuid references vendors(id) on delete cascade;

-- ------------------------------------------------------------- backfill ----
-- The existing single business becomes vendor #1, carrying its org_settings
-- values across. Nothing is deleted.
insert into vendors (slug, business_name, location, whatsapp_number, plan_code, subscription_status, active)
select 'sakura-tackle', business_name, location, whatsapp_number, 'pro', 'active', true
from org_settings where id = 1;

update boats       set vendor_id = (select id from vendors where slug = 'sakura-tackle');
update packages    set vendor_id = (select id from vendors where slug = 'sakura-tackle');
update trip_nights set vendor_id = (select id from vendors where slug = 'sakura-tackle');
update bookings    set vendor_id = (select id from vendors where slug = 'sakura-tackle');
update profiles    set vendor_id = (select id from vendors where slug = 'sakura-tackle'),
                       is_platform_admin = true;

alter table boats       alter column vendor_id set not null;
alter table packages    alter column vendor_id set not null;
alter table trip_nights alter column vendor_id set not null;
alter table bookings    alter column vendor_id set not null;

-- ------------------------------------------- per-vendor unique constraints --
-- Two vendors can legitimately both own a boat coded "TRF 92", both use the
-- slug "trip-malam", and both generate booking ref CS-2703-014.
alter table boats    drop constraint boats_code_key;
alter table boats    add  constraint boats_vendor_code_key unique (vendor_id, code);
alter table packages drop constraint packages_slug_key;
alter table packages add  constraint packages_vendor_slug_key unique (vendor_id, slug);
alter table bookings drop constraint bookings_ref_key;
alter table bookings add  constraint bookings_vendor_ref_key unique (vendor_id, ref);

-- Unindexed FKs make every vendor-scoped policy a sequential scan.
create index boats_vendor_id_idx       on boats (vendor_id);
create index packages_vendor_id_idx    on packages (vendor_id);
create index trip_nights_vendor_id_idx on trip_nights (vendor_id);
create index bookings_vendor_id_idx    on bookings (vendor_id);
create index profiles_vendor_id_idx    on profiles (vendor_id);

-- ------------------------------------------------------ helper functions ---
create or replace function private.current_vendor_id() returns uuid
language sql security definer stable set search_path = public as $$
  select vendor_id from profiles where id = auth.uid() and is_active
$$;
grant execute on function private.current_vendor_id() to anon, authenticated;

create or replace function private.is_platform_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(
    (select is_platform_admin from profiles where id = auth.uid() and is_active),
    false
  )
$$;
grant execute on function private.is_platform_admin() to anon, authenticated;

-- ============================================================ RLS rewrite ===
alter table vendors enable row level security;
alter table plans   enable row level security;

-- plans: pricing is public marketing copy; only the platform edits it.
create policy "plans readable by anyone" on plans for select using (true);
create policy "plans managed by platform admin" on plans for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- vendors: no anon policy at all. The public booking page reads a vendor
-- through get_vendor_public(), which exposes only display fields and never
-- plan_code / subscription_status.
create policy "operator reads own vendor" on vendors for select
  using (id = private.current_vendor_id());
create policy "operator updates own vendor" on vendors for update
  using (id = private.current_vendor_id())
  with check (id = private.current_vendor_id());
create policy "platform admin manages vendors" on vendors for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- profiles
drop policy "read own profile" on profiles;
create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "platform admin reads profiles" on profiles for select
  using (private.is_platform_admin());

-- boats: anon loses its blanket read. The public page never queries boats
-- directly — it goes through get_public_availability(), which returns boat
-- codes for one vendor only.
drop policy "boats readable by anyone" on boats;
drop policy "boats managed by operator" on boats;
create policy "boats scoped to vendor" on boats for all
  using (vendor_id = private.current_vendor_id())
  with check (vendor_id = private.current_vendor_id());
create policy "platform admin manages boats" on boats for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- trip_nights: same reasoning as boats.
drop policy "trip_nights readable by anyone" on trip_nights;
drop policy "trip_nights managed by operator" on trip_nights;
create policy "trip_nights scoped to vendor" on trip_nights for all
  using (vendor_id = private.current_vendor_id())
  with check (vendor_id = private.current_vendor_id());
create policy "platform admin manages trip_nights" on trip_nights for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- packages: anon still needs a direct read — the vendor's public page renders
-- its title, includes and FAQs — but only published rows of active vendors.
drop policy "published packages readable by anyone" on packages;
drop policy "operator reads all packages" on packages;
drop policy "packages managed by operator" on packages;
drop policy "packages updated by operator" on packages;
drop policy "packages deleted by operator" on packages;
create policy "published packages readable by anyone" on packages for select
  using (
    published = true
    and exists (select 1 from vendors v where v.id = packages.vendor_id and v.active)
  );
create policy "packages scoped to vendor" on packages for all
  using (vendor_id = private.current_vendor_id())
  with check (vendor_id = private.current_vendor_id());
create policy "platform admin manages packages" on packages for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- bookings: anon still has zero direct access, exactly as before.
drop policy "bookings full access for operator" on bookings;
create policy "bookings scoped to vendor" on bookings for all
  using (vendor_id = private.current_vendor_id())
  with check (vendor_id = private.current_vendor_id());
create policy "platform admin manages bookings" on bookings for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- booking_pax: scoped through its parent booking.
drop policy "booking_pax managed by operator" on booking_pax;
create policy "booking_pax scoped to vendor" on booking_pax for all
  using (exists (
    select 1 from bookings b
    where b.id = booking_pax.booking_id and b.vendor_id = private.current_vendor_id()
  ))
  with check (exists (
    select 1 from bookings b
    where b.id = booking_pax.booking_id and b.vendor_id = private.current_vendor_id()
  ));
create policy "platform admin manages booking_pax" on booking_pax for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- org_settings is superseded by vendors. Its values were copied above; the
-- table is dropped in a follow-up migration once no deployed code reads it.
drop policy "org_settings readable by anyone" on org_settings;
drop policy "org_settings managed by operator" on org_settings;
create policy "org_settings platform admin only" on org_settings for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- ======================================================== public API RPCs ===

-- Public vendor profile for /v/<slug>. Returns display fields only — never
-- plan_code or subscription_status.
create or replace function public.get_vendor_public(p_slug text)
returns table (id uuid, slug text, business_name text, location text, whatsapp_number text)
language sql security definer stable set search_path = public as $$
  select v.id, v.slug, v.business_name, v.location, v.whatsapp_number
  from vendors v
  where v.slug = p_slug and v.active
$$;
revoke all on function public.get_vendor_public from public;
grant execute on function public.get_vendor_public to anon, authenticated;

-- Availability, now scoped to one vendor.
drop function if exists public.get_public_availability(date, date, int);
create or replace function public.get_public_availability(
  p_vendor_id uuid, p_from date, p_to date, p_pax int default 1
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
    join boats b on b.id = tn.boat_id and b.active and b.vendor_id = p_vendor_id
    left join bookings bk
      on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
    where tn.vendor_id = p_vendor_id
      and tn.night_date between p_from and p_to
    group by tn.night_date, tn.boat_id, b.code, b.capacity, tn.blocked
  ),
  -- the `night_date >= current_date` guards carry over from
  -- 20260903092504_hide_past_nights: a past night must never come back
  -- bookable once the season is underway.
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

-- Booking creation, now vendor-scoped. The package and boat are re-checked
-- against p_vendor_id so a crafted call can't attach a booking to another
-- vendor's boat.
drop function if exists public.create_public_booking(uuid, uuid, date, text, text, text, int, text);
create or replace function public.create_public_booking(
  p_vendor_id uuid, p_package_id uuid, p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text
) returns table (ref text) language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_deposit numeric; v_ref text; v_tries int := 0;
begin
  select price_per_pax, deposit_per_boat into v_price, v_deposit
  from packages
  where id = p_package_id and vendor_id = p_vendor_id and published;

  if v_price is null then
    raise exception 'package not available for this vendor';
  end if;

  if not exists (
    select 1 from boats where id = p_boat_id and vendor_id = p_vendor_id and active
  ) then
    raise exception 'boat not available for this vendor';
  end if;

  -- refs are only unique per vendor now, so retry on collision
  loop
    v_ref := 'CS-' || to_char(p_night_date, 'YYMM') || '-' || lpad(floor(random()*999)::text, 3, '0');
    exit when not exists (
      select 1 from bookings b where b.vendor_id = p_vendor_id and b.ref = v_ref
    );
    v_tries := v_tries + 1;
    if v_tries > 20 then
      raise exception 'could not allocate booking ref';
    end if;
  end loop;

  insert into bookings (
    vendor_id, ref, package_id, boat_id, night_date,
    full_name, phone, email, pax, note, price_per_pax, deposit_amount
  )
  values (
    p_vendor_id, v_ref, p_package_id, p_boat_id, p_night_date,
    p_full_name, p_phone, p_email, p_pax, p_note, v_price, v_deposit
  );

  return query select v_ref;
end;
$$;
revoke all on function public.create_public_booking from public;
grant execute on function public.create_public_booking to anon, authenticated;

-- Booking lookup, scoped to the vendor whose page the customer is on — a
-- phone number shouldn't surface bookings made with other operators.
drop function if exists public.check_booking_by_phone(text);
create or replace function public.check_booking_by_phone(p_vendor_id uuid, p_phone text)
returns table (ref text, boat_code text, night_date date, pax int, status booking_status, balance_due numeric)
language sql security definer stable set search_path = public as $$
  select b.ref, bt.code, b.night_date, b.pax, b.status,
         (b.price_per_pax * b.pax) - (case when b.deposit_paid then b.deposit_amount else 0 end)
  from bookings b join boats bt on bt.id = b.boat_id
  where b.vendor_id = p_vendor_id and b.phone = p_phone
  order by b.night_date desc
$$;
revoke all on function public.check_booking_by_phone from public;
grant execute on function public.check_booking_by_phone to anon, authenticated;

-- Vendor self-signup. Called by an already-authenticated user straight after
-- Supabase Auth sign-up: creates the vendor and the caller's operator profile
-- in one step. Not callable by anon — auth.uid() must exist.
create or replace function public.register_vendor(
  p_business_name text, p_slug text, p_full_name text, p_phone text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_vendor_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'this account already belongs to a vendor';
  end if;

  insert into vendors (slug, business_name, plan_code, subscription_status, trial_ends_at)
  values (p_slug, p_business_name, 'starter', 'trialing', now() + interval '14 days')
  returning id into v_vendor_id;

  insert into profiles (id, vendor_id, full_name, email, phone, role, is_active)
  values (
    v_uid, v_vendor_id, p_full_name,
    coalesce((select email from auth.users where id = v_uid), ''),
    p_phone, 'operator', true
  );

  return v_vendor_id;
end;
$$;
revoke all on function public.register_vendor from public;
grant execute on function public.register_vendor to authenticated;

-- Is a slug still free? Needed by the signup form before submitting.
create or replace function public.is_vendor_slug_available(p_slug text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from vendors where slug = p_slug)
$$;
revoke all on function public.is_vendor_slug_available from public;
grant execute on function public.is_vendor_slug_available to anon, authenticated;

-- ========================================================= storage scoping ==
-- Receipts were keyed by <booking_id>/..., which one vendor's operator could
-- read for another vendor's booking. Re-key to <vendor_id>/<booking_id>/...
-- and check the first path segment. Safe to change the convention outright:
-- there are no stored objects yet.
drop policy "operator manages receipts" on storage.objects;
create policy "receipts scoped to vendor" on storage.objects for all
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  );

drop policy "operator uploads package covers" on storage.objects;
drop policy "operator updates package covers" on storage.objects;
drop policy "operator deletes package covers" on storage.objects;
create policy "package covers written by owning vendor" on storage.objects for insert
  with check (
    bucket_id = 'package-covers'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  );
create policy "package covers updated by owning vendor" on storage.objects for update
  using (
    bucket_id = 'package-covers'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  )
  with check (
    bucket_id = 'package-covers'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  );
create policy "package covers deleted by owning vendor" on storage.objects for delete
  using (
    bucket_id = 'package-covers'
    and (storage.foldername(name))[1] = private.current_vendor_id()::text
  );
-- public read on package-covers is unchanged: covers render on public pages.
