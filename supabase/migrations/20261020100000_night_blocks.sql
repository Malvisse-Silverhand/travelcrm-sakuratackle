-- Block one night for one boat, by admins or the boat's vendor (emergency
-- repair, vendor closed, weather, private charter). Plan:
-- ~/.claude/plans/i-need-some-suggestions-bright-bonbon.md §1
--
-- staff_block_night() creates the night if it is not on the calendar yet
-- (the old Slot manager could only block nights that existed) and returns the
-- live bookings on it, so the screen can warn. It never cancels them.

alter table trip_nights
  add column if not exists block_category text
    check (block_category in ('repair', 'closed', 'weather', 'private', 'other')),
  add column if not exists blocked_by uuid references profiles(id) on delete set null,
  add column if not exists blocked_at timestamptz;

create or replace function public.staff_block_night(
  p_boat uuid, p_night date, p_block boolean, p_category text, p_reason text
) returns table (id uuid, ref text, full_name text, status booking_status)
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not (private.is_operator() or private.is_vendor_of(p_boat)) then
    raise exception 'not allowed';
  end if;
  if p_night is null or p_night < (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'night has passed';
  end if;
  if p_block and coalesce(p_category, '') not in ('repair', 'closed', 'weather', 'private', 'other') then
    raise exception 'invalid category';
  end if;
  if char_length(coalesce(v_reason, '')) > 300 then
    raise exception 'field too long';
  end if;
  perform 1 from boats where boats.id = p_boat;
  if not found then
    raise exception 'boat not available';
  end if;

  insert into trip_nights (boat_id, night_date) values (p_boat, p_night)
  on conflict (boat_id, night_date) do nothing;

  update trip_nights tn
  set blocked = p_block,
      block_category = case when p_block then p_category end,
      blocked_reason = case when p_block then coalesce(v_reason, initcap(p_category)) end,
      blocked_by = case when p_block then auth.uid() end,
      blocked_at = case when p_block then now() end
  where tn.boat_id = p_boat and tn.night_date = p_night;

  return query
    select bk.id, bk.ref, bk.full_name, bk.status
    from bookings bk
    where bk.boat_id = p_boat and bk.night_date = p_night
      and private.is_live_hold(bk.status, bk.deposit_paid, bk.receipt_url, bk.created_at)
    order by bk.created_at;
end;
$$;

revoke all on function public.staff_block_night(uuid, date, boolean, text, text) from public, anon;
grant execute on function public.staff_block_night(uuid, date, boolean, text, text) to authenticated;

-- Blocking and unblocking show in the activity log (and so the bell), with
-- who did it: a vendor closing a night reaches the admins.
create or replace function private.trg_trip_nights_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_boat text;
begin
  if new.blocked is not distinct from coalesce(old.blocked, false) then
    return new;
  end if;
  select code into v_boat from boats where id = new.boat_id;
  if new.blocked then
    perform private.log_activity('night.blocked', 'boat', new.boat_id::text,
      format('%s blocked on %s (%s)%s', coalesce(v_boat, 'Boat'), to_char(new.night_date, 'DD Mon YYYY'),
             coalesce(new.block_category, 'other'),
             case when new.blocked_reason is not null then ': ' || new.blocked_reason else '' end),
      jsonb_build_object('night', new.night_date, 'category', new.block_category));
  else
    perform private.log_activity('night.unblocked', 'boat', new.boat_id::text,
      format('%s open again on %s', coalesce(v_boat, 'Boat'), to_char(new.night_date, 'DD Mon YYYY')),
      jsonb_build_object('night', new.night_date));
  end if;
  return new;
end;
$$;

drop trigger if exists trip_nights_activity on trip_nights;
create trigger trip_nights_activity after insert or update of blocked on trip_nights
  for each row execute function private.trg_trip_nights_activity();
