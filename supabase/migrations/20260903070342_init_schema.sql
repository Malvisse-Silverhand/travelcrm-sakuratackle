-- ENUMS
create type booking_status as enum ('pending','confirmed','deposit_due','weather_hold','cancelled');
create type operator_role as enum ('operator');

-- PROFILES (extends auth.users — operator accounts only, invite-only)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role operator_role not null default 'operator',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- BOATS (fleet)
create table boats (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- e.g. "TRF 92"
  skipper_name text not null,
  capacity int not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- TRIP NIGHTS (one row per boat per bookable night — created on demand or in bulk
-- for the season; a night with no row is simply not offered yet)
create table trip_nights (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid references boats(id) not null,
  night_date date not null,
  blocked boolean default false,        -- operator manually blocks (weather/maintenance)
  blocked_reason text,
  created_at timestamptz default now(),
  unique (boat_id, night_date)
);

-- PACKAGES (the public trip/product page — CMS content behind the "Packages" +
-- "Page builder" admin screens; supports more than one trip product even though only
-- one, "Trip Candat Sotong Otai-Otai", exists at launch)
create table packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  cover_image_url text,
  price_per_pax numeric(10,2) not null default 180,
  deposit_per_boat numeric(10,2) not null default 250,
  includes jsonb not null default '[]',        -- array of strings
  itinerary jsonb not null default '[]',        -- array of {time, title, body}
  faqs jsonb not null default '[]',             -- array of {q, a}
  season_start date,
  season_end date,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BOOKINGS
create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,             -- e.g. CS-2703-014, generated server-side
  package_id uuid references packages(id),
  boat_id uuid references boats(id),
  night_date date not null,
  full_name text not null,
  phone text not null,
  email text,
  pax int not null check (pax > 0),
  note text,
  status booking_status not null default 'pending',
  price_per_pax numeric(10,2) not null,
  deposit_amount numeric(10,2) not null default 250,
  deposit_paid boolean not null default false,
  deposit_paid_at timestamptz,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- total_amount = price_per_pax * pax  (compute in the app or as a generated column)
-- balance_due  = total_amount - (deposit_paid ? deposit_amount : 0)

-- BOOKING PAX (optional named list per booking, shown in Booking Detail)
create table booking_pax (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  full_name text not null,
  sort_order int default 0
);

-- ORG SETTINGS (singleton row — WhatsApp number, business name/location)
create table org_settings (
  id int primary key default 1,
  business_name text not null default 'Sakura Tackle',
  location text not null default 'Jeti Marang, Terengganu',
  whatsapp_number text not null default '60193334821',
  check (id = 1)
);
insert into org_settings (id) values (1);

-- NOTE: "open / selling fast / full" status shown on the calendar is DERIVED, not
-- stored — compute it from confirmed pax vs boat capacity for that night. Do not add
-- a redundant status column that can drift out of sync with actual bookings.
create view trip_night_status as
select
  tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason,
  b.capacity,
  coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) as pax_held,
  case
    when tn.blocked then 'blocked'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity then 'full'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity * 0.7 then 'selling_fast'
    else 'open'
  end as status
from trip_nights tn
join boats b on b.id = tn.boat_id
left join bookings bk on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
group by tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason, b.capacity;
