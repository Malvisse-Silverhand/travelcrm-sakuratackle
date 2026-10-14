-- Phase 4c: multiple admins and vendors, invitations, customer notes,
-- boat photos and an activity log.

-- ===== Roles ================================================================
-- is_operator() used to mean "any active profile". Vendors now have profiles
-- too, so it narrows to role 'operator' (admin). Every existing policy calls
-- it, so all of them stay admin-only without being rewritten.
create or replace function private.is_operator() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_active and role = 'operator'
  )
$$;

-- Which vendor a boat belongs to (null = the operator's own boat).
alter table boats add column if not exists vendor_id uuid references profiles(id) on delete set null;

-- True when the caller is an active vendor and owns this boat.
create or replace function private.is_vendor_of(p_boat uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from profiles p
    join boats b on b.vendor_id = p.id
    where p.id = auth.uid() and p.is_active and p.role = 'vendor' and b.id = p_boat
  )
$$;
grant execute on function private.is_vendor_of(uuid) to authenticated;

-- Vendors read their boats' bookings and pax lists, and may block or unblock
-- their boats' nights. Nothing else: no payments, settings or customers.
create policy "vendor reads own boats' bookings" on bookings
  for select using (private.is_vendor_of(boat_id));
create policy "vendor reads own boats' pax" on booking_pax
  for select using (
    exists (select 1 from bookings b where b.id = booking_id and private.is_vendor_of(b.boat_id))
  );
create policy "vendor blocks own boats' nights" on trip_nights
  for update using (private.is_vendor_of(boat_id)) with check (private.is_vendor_of(boat_id));

-- Admins see and manage every profile (Users & roles); everyone still reads
-- their own.
create policy "admin reads all profiles" on profiles for select using (private.is_operator());
create policy "admin updates profiles" on profiles
  for update using (private.is_operator()) with check (private.is_operator());

-- ===== Invitations ==========================================================
-- Only a SHA-256 of the link token is stored: a leaked table cannot be used
-- to accept an invite. Accepting happens in a server route with the service
-- role, so there is no anon policy at all.
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  role operator_role not null default 'operator',
  boat_ids uuid[] not null default '{}',
  token_hash text not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_user uuid references profiles(id) on delete set null,
  revoked_at timestamptz
);
alter table invites enable row level security;
create policy "admin manages invites" on invites
  for all using (private.is_operator()) with check (private.is_operator());

-- ===== Customer notes =======================================================
-- Customers are derived from bookings by phone number; their notes and tags
-- hang off the same key (local digits, e.g. 0123456789).
create table if not exists customer_notes (
  phone_key text primary key,
  notes text not null default '',
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table customer_notes enable row level security;
create policy "admin manages customer notes" on customer_notes
  for all using (private.is_operator()) with check (private.is_operator());

-- ===== Boat photos ==========================================================
-- Public read: the website shows them as plain <img src>.
insert into storage.buckets (id, name, public)
values ('boat-photos', 'boat-photos', true)
on conflict (id) do nothing;
create policy "anyone can view boat photos" on storage.objects
  for select using (bucket_id = 'boat-photos');
create policy "admin uploads boat photos" on storage.objects
  for insert with check (bucket_id = 'boat-photos' and private.is_operator());
create policy "admin updates boat photos" on storage.objects
  for update using (bucket_id = 'boat-photos' and private.is_operator());
create policy "admin deletes boat photos" on storage.objects
  for delete using (bucket_id = 'boat-photos' and private.is_operator());

-- ===== Activity log =========================================================
-- Written by triggers (so a change cannot skip it) and by the server routes
-- that act through the service role (invites, user changes), which record
-- the admin explicitly because auth.uid() is empty there.
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  details jsonb not null default '{}'
);
create index if not exists activity_log_at on activity_log (at desc);
alter table activity_log enable row level security;
create policy "admin reads activity" on activity_log for select using (private.is_operator());

create or replace function private.log_activity(
  p_action text, p_entity text, p_entity_id text, p_summary text, p_details jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from profiles where id = auth.uid();
  insert into activity_log (actor_id, actor_name, action, entity, entity_id, summary, details)
  values (
    auth.uid(),
    coalesce(v_name, case when auth.uid() is null then 'Website' else 'Unknown' end),
    p_action, p_entity, p_entity_id, p_summary, coalesce(p_details, '{}')
  );
end;
$$;

-- Bookings: created, and any change to status, deposit, boat, night or pax.
create or replace function private.trg_bookings_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform private.log_activity('booking.created', 'booking', new.id::text,
      format('%s booked %s for %s pax (%s)', new.full_name, to_char(new.night_date, 'DD Mon YYYY'), new.pax, new.ref),
      jsonb_build_object('ref', new.ref));
    return new;
  end if;
  if new.status is distinct from old.status then
    v_changes := v_changes || format('status %s → %s', old.status, new.status);
  end if;
  if new.deposit_paid is distinct from old.deposit_paid then
    v_changes := v_changes || case when new.deposit_paid then 'deposit received' else 'deposit unmarked' end;
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
      case when new.deposit_paid and not old.deposit_paid then 'payment.verified' else 'booking.updated' end,
      'booking', new.id::text,
      format('%s: %s', new.ref, array_to_string(v_changes, ', ')),
      jsonb_build_object('ref', new.ref));
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_activity on bookings;
create trigger bookings_activity after insert or update on bookings
  for each row execute function private.trg_bookings_activity();

-- Boats: added, and changes to what customers see or what is on sale.
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
  if array_length(v_changes, 1) > 0 then
    perform private.log_activity('boat.updated', 'boat', new.id::text,
      format('%s: %s', new.code, array_to_string(v_changes, ', ')));
  end if;
  return new;
end;
$$;
drop trigger if exists boats_activity on boats;
create trigger boats_activity after insert or update on boats
  for each row execute function private.trg_boats_activity();

-- Packages: season, deposit and price.
create or replace function private.trg_packages_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_changes text[] := '{}';
begin
  if new.season_start is distinct from old.season_start or new.season_end is distinct from old.season_end then
    v_changes := v_changes || format('season %s – %s', new.season_start, new.season_end);
  end if;
  if new.deposit_per_boat is distinct from old.deposit_per_boat then
    v_changes := v_changes || format('deposit RM%s → RM%s', old.deposit_per_boat, new.deposit_per_boat);
  end if;
  if new.price_per_pax is distinct from old.price_per_pax then
    v_changes := v_changes || format('price RM%s → RM%s per pax', old.price_per_pax, new.price_per_pax);
  end if;
  if new.published is distinct from old.published then
    v_changes := v_changes || case when new.published then 'published' else 'unpublished' end;
  end if;
  if array_length(v_changes, 1) > 0 then
    perform private.log_activity('package.updated', 'package', new.id::text,
      format('%s: %s', new.title, array_to_string(v_changes, ', ')));
  end if;
  return new;
end;
$$;
drop trigger if exists packages_activity on packages;
create trigger packages_activity after update on packages
  for each row execute function private.trg_packages_activity();

-- Customer notes.
create or replace function private.trg_customer_notes_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.log_activity('customer.noted', 'customer', new.phone_key,
    format('Notes for %s updated%s', new.phone_key,
      case when array_length(new.tags, 1) > 0 then ' (' || array_to_string(new.tags, ', ') || ')' else '' end));
  return new;
end;
$$;
drop trigger if exists customer_notes_activity on customer_notes;
create trigger customer_notes_activity after insert or update on customer_notes
  for each row execute function private.trg_customer_notes_activity();

-- Profiles: activated / deactivated / role changed from Users & roles.
create or replace function private.trg_profiles_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active is distinct from old.is_active or new.role is distinct from old.role then
    perform private.log_activity('user.updated', 'user', new.id::text,
      format('%s: %s%s', new.full_name,
        case when new.is_active then 'active' else 'deactivated' end,
        case when new.role is distinct from old.role then ', role ' || new.role::text else '' end));
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_activity on profiles;
create trigger profiles_activity after update on profiles
  for each row execute function private.trg_profiles_activity();
