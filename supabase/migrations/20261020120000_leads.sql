-- Leads: people who asked but have not booked. Board stages New → Contacted
-- → Quoted → Won / Lost. Sources: manual key-in, website holds that expired
-- unpaid, and Google Sheet import. Plan:
-- ~/.claude/plans/i-need-some-suggestions-bright-bonbon.md §4

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  phone_key text not null check (phone_key ~ '^[0-9]{8,15}$'),
  email text check (char_length(email) <= 254),
  source text not null default 'manual'
    check (source in ('manual', 'whatsapp', 'phone', 'facebook', 'instagram', 'walk_in', 'expired_hold', 'import')),
  wanted_date date,
  pax int check (pax between 1 and 100),
  boat_id uuid references boats(id) on delete set null,
  budget numeric(10,2) check (budget >= 0),
  notes text check (char_length(notes) <= 2000),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'quoted', 'won', 'lost')),
  lost_reason text check (char_length(lost_reason) <= 200),
  next_follow_up date,
  owner uuid references profiles(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  hold_booking_id uuid references bookings(id) on delete set null,
  import_batch uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now()
);
create index if not exists leads_stage on leads (stage, next_follow_up);
create index if not exists leads_phone on leads (phone_key);

alter table leads enable row level security;
create policy "admin manages leads" on leads
  for all using (private.is_operator()) with check (private.is_operator());

-- New leads and stage changes in the activity log (and the bell).
create or replace function private.trg_leads_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.import_batch is null then
      perform private.log_activity('lead.created', 'lead', new.id::text,
        format('New lead: %s (%s)%s', new.name, replace(new.source, '_', ' '),
               case when new.wanted_date is not null then ', wants ' || to_char(new.wanted_date, 'DD Mon YYYY') else '' end),
        jsonb_build_object('source', new.source));
    end if;
    return new;
  end if;
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    perform private.log_activity('lead.stage', 'lead', new.id::text,
      format('Lead %s: %s → %s%s', new.name, old.stage, new.stage,
             case when new.stage = 'lost' and new.lost_reason is not null then ' (' || new.lost_reason || ')' else '' end),
      jsonb_build_object('stage', new.stage));
  end if;
  return new;
end;
$$;

drop trigger if exists leads_activity_ins on leads;
drop trigger if exists leads_activity_upd on leads;
create trigger leads_activity_ins after insert on leads
  for each row execute function private.trg_leads_activity();
create trigger leads_activity_upd before update on leads
  for each row execute function private.trg_leads_activity();

-- Expired website holds become leads: they left a name, phone and date, and
-- a follow-up often saves the trip. One open lead per phone.
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
    returning id, full_name, phone, email, night_date, pax, boat_id
  ),
  keyed as (
    select g.*, case when g.phone like '60%' and length(g.phone) >= 11 then '0' || substr(g.phone, 3) else g.phone end as phone_key
    from gone g
  ),
  new_leads as (
    insert into leads (name, phone, phone_key, email, source, wanted_date, pax, boat_id, notes, hold_booking_id, next_follow_up)
    select distinct on (k.phone_key)
      left(k.full_name, 120), k.phone_key, k.phone_key, k.email, 'expired_hold', k.night_date, k.pax, k.boat_id,
      'Website booking expired before payment.', k.id, (now() at time zone 'Asia/Kuala_Lumpur')::date
    from keyed k
    where k.phone_key ~ '^[0-9]{8,15}$'
      and not exists (select 1 from leads l where l.phone_key = k.phone_key and l.stage not in ('won', 'lost'))
    returning 1
  )
  select count(*) into v_n from gone;
  perform set_config('app.expiring', '', true);
  return v_n;
end;
$$;
