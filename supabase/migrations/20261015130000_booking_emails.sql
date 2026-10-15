-- Phase B: customer emails. Each booking gets each email at most once; the
-- server claims the column (update ... where it is null) before sending and
-- clears it again if Resend refuses, so a retry is possible but a double
-- send is not.
alter table bookings
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists paid_email_sent_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;
