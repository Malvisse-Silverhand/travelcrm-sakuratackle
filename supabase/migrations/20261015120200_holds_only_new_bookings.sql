-- Hold expiry applies only to bookings made after it was switched on: the
-- pending bookings that already existed were taken under "we hold it until
-- we hear from you", and cancelling them retroactively is the operator's call.
alter table org_settings add column if not exists holds_since timestamptz not null default now();

create or replace function private.is_live_hold(p_status booking_status, p_paid boolean, p_receipt text, p_created timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select p_status in ('confirmed', 'deposit_due', 'weather_hold')
      or (p_status = 'pending' and (
            p_paid or p_receipt is not null
            or p_created >= private.hold_cutoff()
            or p_created < (select holds_since from org_settings where id = 1)))
$$;

create or replace function private.expire_unpaid_holds() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  perform set_config('app.expiring', '1', true);
  with gone as (
    update bookings set status = 'cancelled', updated_at = now()
    where status = 'pending' and not deposit_paid and receipt_url is null
      and created_at < private.hold_cutoff()
      and created_at >= (select holds_since from org_settings where id = 1)
    returning 1
  )
  select count(*) into v_n from gone;
  perform set_config('app.expiring', '', true);
  return v_n;
end;
$$;
