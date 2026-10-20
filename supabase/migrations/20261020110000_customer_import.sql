-- Customers imported from a Google Sheet (or CSV), with their trips from
-- before the booking system. Plan: ~/.claude/plans/i-need-some-suggestions-bright-bonbon.md §2
--
-- Customers stay keyed by phone (phone_key = local digits, as
-- lib/admin/customers.ts customerKey()). Past trips never touch availability
-- or revenue; they only count towards a customer's history and value.

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('customers', 'leads')),
  file_label text not null check (char_length(file_label) <= 200),
  rows_total int not null default 0,
  rows_added int not null default 0,
  rows_merged int not null default 0,
  rows_skipped int not null default 0,
  trips_added int not null default 0,
  undone_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null unique check (phone_key ~ '^[0-9]{8,15}$'),
  name text not null check (char_length(name) between 1 and 120),
  email text check (char_length(email) <= 254),
  notes text check (char_length(notes) <= 2000),
  tags text[] not null default '{}',
  source text not null default 'import' check (source in ('import', 'manual')),
  import_batch uuid references import_batches(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists past_trips (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null check (phone_key ~ '^[0-9]{8,15}$'),
  trip_date date not null,
  boat_label text check (char_length(boat_label) <= 80),
  pax int check (pax between 1 and 100),
  amount numeric(10,2) check (amount >= 0),
  note text check (char_length(note) <= 500),
  import_batch uuid references import_batches(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists past_trips_phone on past_trips (phone_key, trip_date);

alter table import_batches enable row level security;
alter table customers enable row level security;
alter table past_trips enable row level security;
create policy "admin manages import batches" on import_batches
  for all using (private.is_operator()) with check (private.is_operator());
create policy "admin manages customers" on customers
  for all using (private.is_operator()) with check (private.is_operator());
create policy "admin manages past trips" on past_trips
  for all using (private.is_operator()) with check (private.is_operator());
