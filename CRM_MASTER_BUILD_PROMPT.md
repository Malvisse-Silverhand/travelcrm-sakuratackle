# Sakura Tackle — Candat Sotong Booking System & CRM — Master Build Prompt for Claude Code

> **How to use this file**: Paste this entire document as your first message to Claude Code
> in your new project folder, alongside the design reference files (put the whole
> `design-reference/` folder — including `_ds/`, `support.js`, `image-slot.js`, `uploads/`
> — at the project root so Claude Code can open and re-read them at any time during the
> build). Tell Claude Code explicitly:
> "Read the design reference files first, then follow this build prompt exactly."

---

## 0. Project Identity

- **Project**: Sakura Tackle — Candat Sotong booking system + operator console
- **Purpose**: Public trip-booking page + single-operator CRM for a squid-jigging
  (candat sotong) night-trip business in Marang, Terengganu. Season: Mac–September 2027.
- **Owner**: Kamal Husaini
- **Relationship to other projects**: This is a **separate side project**, unrelated to
  Takaful4Us. Different Supabase project, different Vercel project, different repo.
  Do not reuse or reference Takaful4Us credentials, schema, or brand tokens anywhere.
- **Design source of truth**:
  - `design-reference/Laman Tempahan.dc.html` — public booking page (desktop + mobile)
  - `design-reference/Admin CRM.dc.html` — operator console (desktop + mobile, 8 screens
    via `sc-if` blocks: login, dashboard, calendar, bookings, detail, packages, builder,
    reports, settings)
  - `design-reference/Sakura Tackle Candat Sotong.dc.html` is the canvas file that just
    imports the two files above at different viewport sizes — open it to see how the
    4 reference frames (desktop/mobile × public/admin) are meant to look, but build
    against the two component files directly.
  - **Excluded on purpose**: `Travel Booking System.dc.html` and `Travel CRM Admin.dc.html`
    (if present anywhere near this project) are an earlier, differently-branded draft
    (teal/orange palette) that the canvas file does **not** import. Ignore them — do not
    let them influence styling or structure.
- **Phase scope**: Core booking + ops CRM only. **No online payment gateway integration
  in this phase** — deposit/balance are tracked as records only (cash/bank transfer,
  reconciled manually by the operator, receipt photo uploaded for reference). See Section 8.

---

## 1. Tech Stack (non-negotiable)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Inline design tokens below (match the `.dc.html` files' actual CSS — plain CSS variables or Tailwind, either is fine, but values must match Section 2 exactly) |
| Database + Auth | Supabase (Postgres, Supabase Auth, Row Level Security) |
| Hosting | **Vercel** (auto-deploy from GitHub `main` branch) |
| File storage | Supabase Storage (deposit receipt photos) |

Do not substitute any of these without asking first.

---

## 2. Design System Tokens (extracted directly from the .dc.html files)

### Colors

```js
colors: {
  purple:      "#2E1D6B",  // primary — headings, sidebar bg, buttons text-on-gold, calendar panel bg
  purpleHover: "#4A34A0",  // link hover
  ink:         "#1B1436",  // body text on light backgrounds
  gold:        "#FFB800",  // primary accent — CTAs, active states
  goldDark:    "#F08A00",  // gold gradient end (logo mark, gradients)
  goldDark2:   "#E8890B",  // gold gradient end (dashboard KPI cards)
  bgPage:      "#F5F2FE",  // admin console page background
  bgCanvas:    "#E7E1F7",  // canvas/outer background (rarely used in real app)
  surfaceTint: "#EDE7FB",  // lavender panel/section background
  inputBg:     "#F7F5FE",  // form input background
  textMuted:   "#7A6FA0",  // secondary text, labels
  textMuted2:  "#635A87",  // body/paragraph muted text
  textOnDark:  "#B7ABE0",  // muted text on purple backgrounds
  textOnDark2: "#9C8ED0",
  border:      "rgba(46,29,107,.10)",   // default hairline border
  borderMid:   "rgba(46,29,107,.14)",
  borderStrong:"rgba(46,29,107,.22)",
  success:     "#2FBF71",  // available / confirmed
  successText: "#137A47",
  warnBg:      "#FFB800",  // selling fast / deposit due (reuses gold family)
  warnText:    "#8A6A00",
  warnText2:   "#B07800",
  dangerBg:    "#EF4444",  // full / weather hold
  dangerText:  "#C22B2B",
  whatsapp:    "#1FA855",
}
```

### Typography

- **Display font**: `Poppins` (weights 400/500/600/700) — headings, prices, nav labels
- **Body font**: `Inter` — everything else
- Section titles: 20–22px / 650
- Card titles: 14–17px / 650
- Body: 13–15px / 400–500
- Eyebrow/kicker labels: 10.5–11px / 700, uppercase, letter-spacing .12–.18em, `textMuted`

### Shape & elevation

- Page-level cards/panels: `border-radius: 18–26px`
- Standard cards/buttons/inputs: `border-radius: 11–14px`
- Chips/badges/pill buttons: `border-radius: 999px`
- Card shadow (resting): `0 18px 46px rgba(46,29,107,.07)`
- Elevated frame shadow (used in the design canvas only, not real screens): `0 30px 70px rgba(46,29,107,.12–.14)`
- Focus ring: `2px solid rgba(255,184,0,.7)`, offset 1px

### Layout

- **Public page** (`Laman Tempahan`): centered `max-width:1180px` container, sticky
  blurred header, hero → booking calendar → pricing → FAQ → footer, floating WhatsApp
  pill bottom-right.
- **Admin console** (`Admin CRM`): desktop = fixed 236px purple sidebar + content area;
  mobile (`@container max-width:820px`) = sidebar hidden, bottom 5-tab nav instead
  (`[data-mob]`/`[data-desk]` swap via container queries, **not** media queries — note
  this if you reproduce it with Tailwind, since Tailwind's default responsive variants
  are viewport-based, not container-based; either wrap the shell in a CSS
  `container-type: inline-size` block as the design does, or use viewport breakpoints
  consistently — pick one and apply it everywhere, don't mix).
- Breakpoint: 820px (not the usual 768px) — match the design's actual breakpoint.

---

## 3. Role Model — much simpler than a multi-agent CRM, read this carefully

This is a **single-operator business**, not a sales team with a hierarchy. The design
only shows one authenticated role ("Operator sign in") — there is no manager/agent tier
visible anywhere in the two design files. Do not invent a role hierarchy that isn't in
the design.

**MVP role model:**

| Actor | Access |
|---|---|
| **Public (anonymous, no login)** | View the booking calendar and package/pricing page. Submit a new booking request. Check their own booking status by phone number (via a scoped lookup — see Section 5, do **not** give anon a blanket read on the bookings table). |
| **Operator (authenticated)** | Full read/write on boats, trip nights, bookings, packages, settings, reports. There is currently only one operator account tier. |

**Cheap insurance for later, matching the `tenant_id` pattern used on the Takaful4Us
project**: add a `role` enum column on `profiles` now, with a single value `'operator'`,
rather than hardcoding "if authenticated then full access" everywhere. If Mal hires
staff later and wants an `owner`-only restriction (e.g. only the owner can edit
pricing/fleet, staff can only manage bookings day-to-day), that becomes a one-line RLS
change instead of a schema migration. **Do not build any owner/staff distinction now
— just leave the column in place for a cheap future add.**

---

## 4. Database Schema (Supabase / Postgres)

```sql
-- ENUMS
create type booking_status as enum ('pending','confirmed','deposit_due','weather_hold','cancelled');
create type operator_role as enum ('operator');

-- PROFILES (extends auth.users — operator accounts only, invite-only)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role operator_role not null default 'operator',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- BOATS (fleet)
create table boats (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- e.g. "TRF 92"
  skipper_name text not null,
  capacity int not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- TRIP NIGHTS (one row per boat per bookable night — created on demand or in bulk
-- for the season; a night with no row is simply not offered yet)
create table trip_nights (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid references boats(id) not null,
  night_date date not null,
  blocked boolean default false,        -- operator manually blocks (weather/maintenance)
  blocked_reason text,
  created_at timestamptz default now(),
  unique (boat_id, night_date)
);
-- NOTE: "open / selling fast / full" status shown on the calendar is DERIVED, not
-- stored — compute it from confirmed pax vs boat capacity for that night (see the
-- `trip_night_status` view below). Do not add a redundant status column that can drift
-- out of sync with actual bookings.

create view trip_night_status as
select
  tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason,
  b.capacity,
  coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) as pax_held,
  case
    when tn.blocked then 'blocked'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity then 'full'
    when coalesce(sum(bk.pax) filter (where bk.status in ('confirmed','deposit_due')), 0) >= b.capacity * 0.7 then 'selling_fast'
    else 'open'
  end as status
from trip_nights tn
join boats b on b.id = tn.boat_id
left join bookings bk on bk.boat_id = tn.boat_id and bk.night_date = tn.night_date
group by tn.id, tn.boat_id, tn.night_date, tn.blocked, tn.blocked_reason, b.capacity;

-- PACKAGES (the public trip/product page — CMS content behind the "Packages" +
-- "Page builder" admin screens; supports more than one trip product even though only
-- one, "Trip Candat Sotong Otai-Otai", exists at launch)
create table packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  cover_image_url text,
  price_per_pax numeric(10,2) not null default 180,
  deposit_per_boat numeric(10,2) not null default 250,
  includes jsonb not null default '[]',        -- array of strings
  itinerary jsonb not null default '[]',        -- array of {time, title, body}
  faqs jsonb not null default '[]',             -- array of {q, a}
  season_start date,
  season_end date,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BOOKINGS
create table bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,             -- e.g. CS-2703-014, generated server-side
  package_id uuid references packages(id),
  boat_id uuid references boats(id),
  night_date date not null,
  full_name text not null,
  phone text not null,
  email text,
  pax int not null check (pax > 0),
  note text,
  status booking_status not null default 'pending',
  price_per_pax numeric(10,2) not null,
  deposit_amount numeric(10,2) not null default 250,
  deposit_paid boolean not null default false,
  deposit_paid_at timestamptz,
  receipt_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- total_amount = price_per_pax * pax  (compute in the app or as a generated column)
-- balance_due  = total_amount - (deposit_paid ? deposit_amount : 0)

-- BOOKING PAX (optional named list per booking, shown in Booking Detail)
create table booking_pax (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  full_name text not null,
  sort_order int default 0
);

-- ORG SETTINGS (singleton row — WhatsApp number, business name/location)
create table org_settings (
  id int primary key default 1,
  business_name text not null default 'Sakura Tackle',
  location text not null default 'Jeti Marang, Terengganu',
  whatsapp_number text not null default '60193334821',
  check (id = 1)
);
insert into org_settings (id) values (1);
```

---

## 5. Row Level Security — implement exactly this logic

**This is the single most important section of this document to get right.** Unlike a
fully-authenticated internal CRM, this app has a genuine public-facing surface that
collects real customer PDPA data (name, phone, email). A naive "allow anon insert/select
on bookings" policy would let anyone with the public anon key **read every customer's
name and phone number** off the table directly via the Supabase REST API, bypassing the
UI entirely. Do not do that. Use scoped RPC functions for every anon-facing operation
that touches `bookings`.

```sql
alter table boats enable row level security;
alter table trip_nights enable row level security;
alter table packages enable row level security;
alter table bookings enable row level security;
alter table booking_pax enable row level security;
alter table org_settings enable row level security;
alter table profiles enable row level security;

-- Helper: is the current request from a signed-in operator?
create or replace function public.is_operator() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

-- ===== PROFILES =====
create policy "read own profile" on profiles for select using (id = auth.uid());
-- Inserts happen via Supabase Auth Admin API (invite flow) using the service role key
-- from a server route — no client INSERT policy needed.

-- ===== BOATS (public needs to see fleet codes/capacity for the calendar; only
-- operator can manage the fleet) =====
create policy "boats readable by anyone" on boats for select using (true);
create policy "boats managed by operator" on boats for all using (is_operator()) with check (is_operator());

-- ===== TRIP_NIGHTS (public needs availability; only operator blocks nights) =====
create policy "trip_nights readable by anyone" on trip_nights for select using (true);
create policy "trip_nights managed by operator" on trip_nights for all using (is_operator()) with check (is_operator());
-- trip_night_status is a plain view over these two tables' SELECT policies — no
-- separate RLS needed on the view itself (views inherit the querying role's access
-- to the underlying tables in Postgres, as long as the view owner also has that access).

-- ===== PACKAGES (public sees published packages; operator manages) =====
create policy "published packages readable by anyone" on packages for select using (published = true);
create policy "operator reads all packages" on packages for select using (is_operator());
create policy "packages managed by operator" on packages for insert with check (is_operator());
create policy "packages updated by operator" on packages for update using (is_operator());
create policy "packages deleted by operator" on packages for delete using (is_operator());

-- ===== ORG_SETTINGS (whatsapp number etc. needed by the public page; only operator writes) =====
create policy "org_settings readable by anyone" on org_settings for select using (true);
create policy "org_settings managed by operator" on org_settings for update using (is_operator());

-- ===== BOOKINGS: no direct anon INSERT or SELECT policy at all. =====
-- Operator gets full access via RLS. The public form and "check my booking" feature
-- go through SECURITY DEFINER functions instead (Section 6), which run with elevated
-- privilege but only expose exactly the fields/rows they're designed to.
create policy "bookings full access for operator" on bookings for all using (is_operator()) with check (is_operator());

-- ===== BOOKING_PAX (operator only — not needed by the public flow) =====
create policy "booking_pax managed by operator" on booking_pax for all using (is_operator()) with check (is_operator());
```

---

## 6. Public-facing functions (replace anon table access)

Create these as Postgres `SECURITY DEFINER` functions (pinned `search_path`), called
via `supabase.rpc(...)` from the public booking page. This is the correct way to let
anonymous visitors interact with a table that otherwise has zero anon policies.

```sql
-- 1. Create a booking (public form submit). Server-controls status/deposit fields —
--    the caller cannot set them directly.
create or replace function public.create_public_booking(
  p_package_id uuid, p_boat_id uuid, p_night_date date,
  p_full_name text, p_phone text, p_email text, p_pax int, p_note text
) returns table (ref text) language plpgsql security definer set search_path = public as $$
declare
  v_price numeric; v_deposit numeric; v_ref text;
begin
  select price_per_pax, deposit_per_boat into v_price, v_deposit
  from packages where id = p_package_id;

  v_ref := 'CS-' || to_char(p_night_date, 'YYMM') || '-' || lpad(floor(random()*999)::text, 3, '0');

  insert into bookings (ref, package_id, boat_id, night_date, full_name, phone, email, pax, note, price_per_pax, deposit_amount)
  values (v_ref, p_package_id, p_boat_id, p_night_date, p_full_name, p_phone, p_email, p_pax, p_note, v_price, v_deposit);

  return query select v_ref;
end;
$$;
revoke all on function public.create_public_booking from public;
grant execute on function public.create_public_booking to anon, authenticated;

-- 2. Check booking status by phone — returns ONLY the fields the public UI shows,
--    never email/note/other customers' rows, and only exact-match on the phone given.
create or replace function public.check_booking_by_phone(p_phone text)
returns table (ref text, boat_code text, night_date date, pax int, status booking_status, balance_due numeric)
language sql security definer stable set search_path = public as $$
  select b.ref, bt.code, b.night_date, b.pax, b.status,
         (b.price_per_pax * b.pax) - (case when b.deposit_paid then b.deposit_amount else 0 end)
  from bookings b join boats bt on bt.id = b.boat_id
  where b.phone = p_phone
  order by b.night_date desc;
$$;
revoke all on function public.check_booking_by_phone from public;
grant execute on function public.check_booking_by_phone to anon, authenticated;
```

**Rate-limiting note (flag, don't necessarily solve in v1):** `check_booking_by_phone`
is a phone-number lookup callable by anyone with the public anon key. It's scoped
correctly (no data leakage across rows), but nothing stops someone from brute-forcing
phone numbers by calling it repeatedly. For an MVP with low traffic this is an
acceptable risk; if booking volume grows, add a Supabase Edge Function in front of it
with basic rate-limiting instead of calling the RPC directly from the browser.

---

## 7. Screen Inventory (build in this order)

Each screen maps to a section in the two design files — re-open the matching file
before building, every time, even within the same session.

| # | Screen | Design ref file | Notes |
|---|---|---|---|
| 1 | Public booking page | `Laman Tempahan.dc.html` | Hero, booking calendar (pax-size chips + month calendar, colored by derived `trip_night_status`), booking form (name/phone/pax/email/note), "Semak Booking Saya" tab (calls `check_booking_by_phone`), pricing section, FAQ accordion, footer, floating WhatsApp button. No login needed. |
| 2 | Operator login | `Admin CRM.dc.html` (`showLogin` block) | Email/password via Supabase Auth. Copy: "Access is limited to registered boat operators." No public sign-up route. |
| 3 | Dashboard | `Admin CRM.dc.html` (`scDash`) | "Sailing tonight" card (boats going out + total pax), "Deposit outstanding" card, 4 KPI tiles, tonight's manifest list (tap → Booking Detail). |
| 4 | Calendar / slot manager | `Admin CRM.dc.html` (`scCal`) | Boat filter chips, month calendar using the same `trip_night_status` view as the public page, "Assign booking" / "Block night" actions on the selected night. |
| 5 | Bookings list | `Admin CRM.dc.html` (`scBookings`) | Status filter chips, 2-column card grid, tap → Booking Detail. |
| 6 | Booking detail | `Admin CRM.dc.html` (`scDetail`) | Header (name, ref, status), boat/night/phone/weather, pax list, skipper note, payment panel (deposit received / balance at jetty, receipt image), "WhatsApp customer" (wa.me deep-link, pre-filled message), "Cancel booking." |
| 7 | Packages list | `Admin CRM.dc.html` (`scPackages`) | Card grid of `packages` rows, "Edit page" → Package Builder, "Duplicate." |
| 8 | Package builder | `Admin CRM.dc.html` (`scBuilder`) | Tabs: Overview (title/sub/cover), Itinerary (ordered steps), Pricing (price/deposit/includes), FAQ, Preview (live mirror of the public trip card). |
| 9 | Reports | `Admin CRM.dc.html` (`scReports`) | Season revenue total, per-week bar chart, revenue-by-boat table. Derive all numbers from `bookings`, don't hardcode. |
| 10 | Settings | `Admin CRM.dc.html` (`scSettings`) | Fleet list (add/edit boats), booking rules (deposit default, WhatsApp number, season dates) — reads/writes `boats` and `org_settings`. |
| 11 | Empty states | *(reuse pattern from Prestige Legacy's `Empty state` convention)* | "No bookings yet," "No results for [filter]" — apply everywhere a list can be empty. |

Mobile bottom nav (5 items, per `Admin CRM.dc.html`'s `navItems`): match whatever
labels/icons are in that file's script block exactly — do not invent new ones.

---

## 8. OUT OF SCOPE for this phase (explicitly deferred — do not build)

- ❌ Online payment gateway (CHIP, Stripe, etc.) — deposits are tracked as records only;
  the operator marks `deposit_paid` manually after checking their own bank/cash
- ❌ WhatsApp automation/drip sequences (Wablas/Pabbly) — the "WhatsApp customer" button
  is a plain `wa.me` deep-link, not an integration
- ❌ Multi-operator / staff role split (`owner` vs `staff`) — the `role` column exists
  for cheap future insurance only, do not build any UI or RLS branching on it yet
- ❌ Multi-tenant / white-label support — this is a single-business app
- ❌ AI features of any kind
- ❌ Automated public-holiday data feed — hardcode the known 2027 Malaysia holidays as a
  static list in the app (same approach as the design file's own `HOLIDAYS` constant),
  don't build a holiday-API integration for this

If asked to add any of the above, decline and note it's deferred to a later phase.

---

## 9. Build Checklist (tick off in order)

- [ ] Next.js + TypeScript scaffolded, repo on GitHub (`travelcrm-sakuratackle`)
- [ ] Design tokens match Section 2 exactly (colors, fonts, radii, the 820px container breakpoint)
- [ ] Supabase project created (separate from Takaful4Us); schema from Section 4 applied via migration
- [ ] `trip_night_status` view created and confirmed returning correct derived status
- [ ] RLS policies from Section 5 applied — confirm via the Supabase Security Advisor
      that `bookings` shows **zero** anon-accessible policies
- [ ] Both RPC functions from Section 6 created, `EXECUTE` revoked from `public` then
      explicitly re-granted to `anon`/`authenticated` only
- [ ] Supabase Auth invite flow working; public signup disabled
- [ ] Public booking page built and matches `Laman Tempahan.dc.html`, calendar reads
      live from `trip_night_status`, booking form calls `create_public_booking`, check
      tab calls `check_booking_by_phone`
- [ ] Operator login built
- [ ] Dashboard built (desktop + mobile)
- [ ] Calendar / slot manager built, "Block night" writes to `trip_nights.blocked`
- [ ] Bookings list + Booking Detail built, payment fields wired to real columns,
      receipt upload wired to Supabase Storage
- [ ] Packages list + Package Builder built, public page actually reads from `packages`
      (not hardcoded copy)
- [ ] Reports built from real `bookings` aggregates
- [ ] Settings built, writes to `boats` and `org_settings`
- [ ] Empty states applied across all lists
- [ ] Write-safety audit done: every `.insert()`/`.update()`/`.delete()` call verified
      to check `data.length` before treating it as success (see create-crm-v1 skill)
- [ ] Visual QA: every screen compared side-by-side against the matching `.dc.html` file
- [ ] Deployed to Vercel, env vars set
- [ ] Manually create the first operator account (Section 9 of `SETUP_GUIDE.md`)
- [ ] Handoff note written for what's deferred (Section 8) for the next phase

---

## 10. Instruction to Claude Code

> Build this project section by section, in the exact order of Section 7. After each
> screen, show me a preview and wait for my confirmation before moving to the next one.
> Always re-open the matching `.dc.html` file to check exact colors, spacing, and copy
> before marking a screen done — do not rely on memory of earlier parts of this
> conversation. Do not implement anything listed in Section 8 unless I explicitly ask
> for it later. Treat Section 5's RLS design as non-negotiable: `bookings` must never
> get a direct anon SELECT or INSERT policy — public access to bookings only ever goes
> through the two functions in Section 6.
