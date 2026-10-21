-- Payments ledger and official receipts.
--
-- Every payment is one row: deposit, full payment, balance at the jetty, a
-- refund, or anything an admin records by hand (cash, DuitNow…). Each row
-- gets a receipt number (ST-2026-0001; refunds RF-2026-0001) and an
-- unguessable token for its public receipt page (/receipt/<token>).
--
-- Rows are written automatically by a trigger on bookings, whichever screen
-- marks the money (booking actions, Payments page, New booking), so the
-- ledger cannot drift from the booking. Undoing a payment voids its receipt
-- instead of deleting it: receipt numbers are never reused.
--
-- Admins only (RLS). Vendors never see money, as before.

-- ===== Business details printed on receipts ===============================
alter table org_settings
  add column if not exists legal_name text check (char_length(legal_name) <= 120),
  add column if not exists ssm_no text check (char_length(ssm_no) <= 40),
  add column if not exists sst_no text check (char_length(sst_no) <= 40),
  add column if not exists address text check (char_length(address) <= 300),
  add column if not exists business_email text check (char_length(business_email) <= 254);

-- ===== Receipt numbers =====================================================
create table if not exists receipt_counters (
  series text not null,
  year int not null,
  last int not null default 0,
  primary key (series, year)
);
alter table receipt_counters enable row level security;
-- No policies: only the security-definer numbering function touches it.

create or replace function private.next_receipt_no(p_series text, p_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from (p_at at time zone 'Asia/Kuala_Lumpur'))::int;
  v_n int;
begin
  insert into receipt_counters (series, year, last) values (p_series, v_year, 1)
  on conflict (series, year) do update set last = receipt_counters.last + 1
  returning last into v_n;
  return format('%s-%s-%s', p_series, v_year, lpad(v_n::text, 4, '0'));
end;
$$;

-- ===== Payments ============================================================
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'full', 'balance', 'refund', 'other')),
  amount numeric(10,2) not null check (amount > 0),
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer', 'duitnow', 'cash', 'card', 'online', 'other')),
  paid_at timestamptz not null default now(),
  proof_path text check (char_length(proof_path) <= 300),
  note text check (char_length(note) <= 500),
  receipt_no text unique,
  receipt_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 200),
  emailed_at timestamptz,
  whatsapped_at timestamptz
);
create index if not exists payments_booking on payments (booking_id, paid_at);

alter table payments enable row level security;
create policy "admin manages payments" on payments
  for all using (private.is_operator()) with check (private.is_operator());

create or replace function private.trg_payments_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.receipt_no is null then
    new.receipt_no := private.next_receipt_no(case when new.kind = 'refund' then 'RF' else 'ST' end, new.paid_at);
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists payments_number on payments;
create trigger payments_number before insert on payments
  for each row execute function private.trg_payments_number();

-- ===== Bookings → payments =================================================
create or replace function private.trg_bookings_payments() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_upfront numeric;
  v_balance numeric;
begin
  v_upfront := case when new.pay_plan = 'full' then new.total_amount else new.deposit_amount end;
  v_balance := greatest(new.total_amount - v_upfront, 0);

  -- Deposit (or full payment) received.
  if new.deposit_paid and (tg_op = 'INSERT' or not old.deposit_paid) then
    insert into payments (booking_id, kind, amount, method, paid_at, proof_path, note)
    values (new.id, case when new.pay_plan = 'full' then 'full' else 'deposit' end, v_upfront,
            case when new.source in ('walk_in') then 'cash' else 'bank_transfer' end,
            coalesce(new.deposit_paid_at, now()), new.receipt_url, null);
  end if;
  if tg_op = 'INSERT' then
    return new;
  end if;

  -- Deposit unmarked: void its receipt.
  if old.deposit_paid and not new.deposit_paid then
    update payments set voided_at = now(), void_reason = 'Payment unmarked'
    where booking_id = new.id and kind in ('deposit', 'full') and voided_at is null;
  end if;

  -- Balance collected at the jetty.
  if new.balance_paid and not old.balance_paid and v_balance > 0 then
    insert into payments (booking_id, kind, amount, method, paid_at)
    values (new.id, 'balance', v_balance, 'cash', coalesce(new.balance_paid_at, now()));
  end if;
  if old.balance_paid and not new.balance_paid then
    update payments set voided_at = now(), void_reason = 'Balance unmarked'
    where booking_id = new.id and kind = 'balance' and voided_at is null;
  end if;

  -- Refund paid back.
  if new.refunded_at is not null and old.refunded_at is null and coalesce(new.refund_amount, 0) > 0 then
    insert into payments (booking_id, kind, amount, method, paid_at)
    values (new.id, 'refund', new.refund_amount, 'bank_transfer', new.refunded_at);
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_payments on bookings;
create trigger bookings_payments after insert or update of deposit_paid, balance_paid, refunded_at on bookings
  for each row execute function private.trg_bookings_payments();

-- ===== Backfill: bookings already paid ====================================
-- Numbered in the order the money arrived.
insert into payments (booking_id, kind, amount, method, paid_at, proof_path, created_by)
select b.id,
       case when b.pay_plan = 'full' then 'full' else 'deposit' end,
       case when b.pay_plan = 'full' then b.total_amount else b.deposit_amount end,
       'bank_transfer',
       coalesce(b.deposit_paid_at, b.updated_at, b.created_at),
       b.receipt_url,
       null
from bookings b
where b.deposit_paid
  and not exists (select 1 from payments p where p.booking_id = b.id)
  and (case when b.pay_plan = 'full' then b.total_amount else b.deposit_amount end) > 0
order by coalesce(b.deposit_paid_at, b.updated_at, b.created_at);
