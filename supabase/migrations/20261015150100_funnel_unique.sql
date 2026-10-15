-- Two calls for the same step at the same instant (React runs effects twice
-- in development; a double click in production) both passed the "already
-- logged?" check. A unique index makes one row per session per step certain.
delete from funnel_events a using funnel_events b
where a.session = b.session and a.event = b.event and a.id > b.id;

drop index if exists funnel_events_session;
create unique index if not exists funnel_events_session_event on funnel_events (session, event);

create or replace function public.log_funnel_event(
  p_event text, p_session text, p_boat_id uuid default null, p_pax int default null, p_jetty text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into funnel_events (event, session, boat_id, pax, jetty)
  values (p_event, p_session, p_boat_id, p_pax, left(p_jetty, 40))
  on conflict (session, event) do nothing;
exception when check_violation then
  -- Unknown step or a malformed session: ignore rather than error the page.
  return;
end;
$$;
