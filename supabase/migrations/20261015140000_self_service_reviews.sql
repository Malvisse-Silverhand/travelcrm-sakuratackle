-- Phase D: customer self-service and reviews.
--
-- 1. booking_requests: what a customer asks for from Manage My Booking. A
--    date change waits for an admin to apply it; a cancellation happens at
--    once (the booking is cancelled and the night released) and leaves a
--    request carrying the refund the terms give, for the admin to pay.
--    Written only by server routes (service role) after the reference and
--    phone are proved together; admins manage them in the console.
--
-- 2. reviews: one per booking, after the trip. They arrive 'pending' and are
--    published by an admin. The public reads published ones through
--    get_published_reviews(), which exposes no booking or contact details.
--
-- 3. bookings.review_request_sent_at: the post-trip "How was your trip?"
--    email goes out once (daily cron).

-- ===== 1. Requests ==========================================================
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null check (kind in ('reschedule', 'cancel')),
  new_date date,
  note text check (char_length(note) <= 1000),
  refund_amount numeric(10,2),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);
create index if not exists booking_requests_booking on booking_requests (booking_id);
alter table booking_requests enable row level security;
create policy "admin manages booking requests" on booking_requests
  for all using (private.is_operator()) with check (private.is_operator());

create or replace function private.trg_booking_requests_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
  v_name text;
begin
  select ref, full_name into v_ref, v_name from bookings where id = new.booking_id;
  if tg_op = 'INSERT' then
    perform private.log_activity(
      'request.' || new.kind, 'booking', new.booking_id::text,
      case new.kind
        when 'reschedule' then format('%s (%s) asks to move to %s', v_ref, v_name, to_char(new.new_date, 'DD Mon YYYY'))
        else format('%s (%s) cancelled online%s', v_ref, v_name,
               case when coalesce(new.refund_amount, 0) > 0 then format(', refund RM%s due', new.refund_amount) else '' end)
      end,
      jsonb_build_object('ref', v_ref));
  elsif new.status is distinct from old.status then
    perform private.log_activity('request.updated', 'booking', new.booking_id::text,
      format('%s: %s request %s', v_ref, new.kind, new.status), jsonb_build_object('ref', v_ref));
  end if;
  return new;
end;
$$;
drop trigger if exists booking_requests_activity on booking_requests;
create trigger booking_requests_activity after insert or update on booking_requests
  for each row execute function private.trg_booking_requests_activity();

-- ===== 2. Reviews ===========================================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  boat_id uuid references boats(id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table reviews enable row level security;
create policy "admin manages reviews" on reviews
  for all using (private.is_operator()) with check (private.is_operator());

create or replace function public.get_published_reviews()
returns table (id uuid, name text, rating int, comment text, boat_id uuid, boat_code text, trip_date date, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.id, r.name, r.rating, r.comment, r.boat_id, b.code, bk.night_date, r.created_at
  from reviews r
  join bookings bk on bk.id = r.booking_id
  left join boats b on b.id = r.boat_id
  where r.status = 'published'
  order by r.created_at desc
  limit 500
$$;
revoke all on function public.get_published_reviews from public;
grant execute on function public.get_published_reviews to anon, authenticated;

create or replace function private.trg_reviews_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
begin
  select ref into v_ref from bookings where id = new.booking_id;
  if tg_op = 'INSERT' then
    perform private.log_activity('review.created', 'review', new.id::text,
      format('%s rated %s★ (%s)%s', new.name, new.rating, v_ref,
        case when coalesce(new.comment, '') <> '' then ': ' || left(new.comment, 80) else '' end),
      jsonb_build_object('ref', v_ref));
  elsif new.status is distinct from old.status then
    perform private.log_activity('review.updated', 'review', new.id::text,
      format('Review by %s (%s) %s', new.name, v_ref, new.status), jsonb_build_object('ref', v_ref));
  end if;
  return new;
end;
$$;
drop trigger if exists reviews_activity on reviews;
create trigger reviews_activity after insert or update on reviews
  for each row execute function private.trg_reviews_activity();

-- ===== 3. Post-trip email ===================================================
alter table bookings add column if not exists review_request_sent_at timestamptz;
