-- Phase E: the booking funnel. Each step a visitor reaches is one row,
-- keyed by a random per-tab session id; no names, phones or IP addresses.
-- The website writes through log_funnel_event (anon), which only accepts the
-- known step names and small payloads; only admins can read the table.
--
--   home_view      homepage opened (once per session)
--   search         SEARCH AVAILABLE BOATS pressed
--   boat_view      /book opened for a boat
--   date_picked    a night chosen on /book
--   details        reached Your Details
--   payment        reached Payment
--   booked         booking created

create table if not exists funnel_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null check (event in ('home_view', 'search', 'boat_view', 'date_picked', 'details', 'payment', 'booked')),
  session text not null check (char_length(session) between 8 and 64),
  boat_id uuid,
  pax int check (pax between 1 and 100),
  jetty text check (char_length(jetty) <= 40)
);
create index if not exists funnel_events_at on funnel_events (at desc);
alter table funnel_events enable row level security;
create policy "admin reads funnel" on funnel_events for select using (private.is_operator());

create or replace function public.log_funnel_event(
  p_event text, p_session text, p_boat_id uuid default null, p_pax int default null, p_jetty text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- One row per session per step: a reload or a back-and-forth does not
  -- inflate the funnel.
  if exists (
    select 1 from funnel_events
    where session = p_session and event = p_event and at > now() - interval '12 hours'
  ) then
    return;
  end if;
  insert into funnel_events (event, session, boat_id, pax, jetty)
  values (p_event, p_session, p_boat_id, p_pax, left(p_jetty, 40));
exception when check_violation then
  -- Unknown step or a malformed session: ignore rather than error the page.
  return;
end;
$$;
revoke all on function public.log_funnel_event from public;
grant execute on function public.log_funnel_event to anon, authenticated;

create index if not exists funnel_events_session on funnel_events (session, event);
