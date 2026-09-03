# Sakura Tackle CRM — Vercel + Supabase Setup Guide

**Repo:** `https://github.com/Malvisse-Silverhand/travelcrm-sakuratackle.git` (currently empty)
**Companion doc:** `CRM_MASTER_BUILD_PROMPT.md` — read that first for schema/screens/rules.
This guide is only about **infrastructure setup**: getting Next.js, Supabase, and Vercel
wired together and deployed, so Claude Code has a live foundation to build screens on.

This mirrors the exact process used for the Prestige Legacy (Takaful4Us) CRM — same
order, same tooling choices — adjusted only for this project's name and repo. **Use a
completely separate Supabase project and Vercel project from Takaful4Us.** Do not reuse
credentials, org, or env vars between the two.

---

## Phase 1 — Prerequisites (skip anything you already installed for Prestige Legacy)

If Node.js, Git, and the Vercel CLI are already installed on this machine from the
Prestige Legacy build, skip straight to the account checklist below.

```powershell
node -v      # need v18.18+ or v20+
git --version
vercel --version
```

If any of those fail, reuse the exact install steps from Prestige Legacy's own
`SETUP_GUIDE.md` (`winget install --id OpenJS.NodeJS.LTS -e --source winget`,
`winget install --id Git.Git -e --source winget`, `npm install -g vercel`) — no changes
needed there, it's machine-level tooling, not project-specific.

Accounts you need for **this** project specifically:
- [ ] GitHub access to `Malvisse-Silverhand/travelcrm-sakuratackle` (confirmed public, empty, `main` branch — ready to clone into)
- [ ] A **new, separate** Supabase project (do not reuse the Takaful4Us one)
- [ ] A **new, separate** Vercel project (can be under the same Vercel account, just a
      different project — Vercel handles multiple unrelated projects fine)

---

## Phase 2 — Clone the repo & scaffold Next.js

```bash
git clone https://github.com/Malvisse-Silverhand/travelcrm-sakuratackle.git
cd travelcrm-sakuratackle

npx create-next-app@latest .
# TypeScript = Yes, ESLint = Yes, Tailwind = Yes, src/ directory = Yes,
# App Router = Yes, import alias = keep default @/*

npm run dev
# confirm http://localhost:3000 shows the default Next.js page, then Ctrl+C
```

```bash
git add .
git commit -m "chore: scaffold Next.js app"
git push origin main
```

**Now copy the design reference in** — this is the step that most affects build
quality, don't skip it:

```bash
mkdir design-reference
# copy in: Admin CRM.dc.html, Laman Tempahan.dc.html,
# Sakura Tackle Candat Sotong.dc.html, the _ds/ folder, support.js, image-slot.js,
# and the uploads/ folder — everything from the design zip except
# "Travel Booking System.dc.html" and "Travel CRM Admin.dc.html" (excluded per
# CRM_MASTER_BUILD_PROMPT.md Section 0 — those are a superseded draft)

git add design-reference/
git commit -m "docs: add design reference files"
git push origin main
```

```powershell
npm install -D supabase
npx supabase --version
```

---

## Phase 3 — Create the Supabase project

**In the browser** (https://supabase.com/dashboard):

1. Click **New Project**
2. Organisation: can be the same org as Takaful4Us, or a new one — your call, but the
   **project** itself must be new/separate
3. Project name: `sakura-tackle-crm`
4. Database password: generate a strong one, save it in your password manager
5. Region: **Singapore (ap-southeast-1)**
6. Pricing plan: Free tier is enough to start
7. Click **Create new project**

**On the project-creation/API settings screen**, set:
- Data API: **enabled** (required)
- "Automatically expose new tables": **disabled** — access is controlled explicitly via
  the RLS policies in `CRM_MASTER_BUILD_PROMPT.md` Section 5, not Supabase's default
- "Enable automatic RLS": **enabled** — harmless safety net alongside manual policies

**Once created**, go to **Project Settings → API** and note down:

| Value | Where to find it | Used where |
|---|---|---|
| Project URL | Settings → API → "Project URL" | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | Settings → API → "Project API keys" | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | Settings → API → "Project API keys" (click "Reveal") | `SUPABASE_SERVICE_ROLE_KEY` — server-only |

Also note your **Project Ref** for the CLI link step below.

---

## Phase 4 — Database schema via Supabase CLI (schema as code)

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <project-ref>
```

```bash
npx supabase migration new init_schema
```
Paste the **full schema from `CRM_MASTER_BUILD_PROMPT.md` Section 4** (enums,
`profiles`, `boats`, `trip_nights`, the `trip_night_status` view, `packages`,
`bookings`, `booking_pax`, `org_settings`) into this file — copy it exactly.

```bash
npx supabase migration new rls_and_functions
```
Paste **both Section 5 (RLS policies) and Section 6 (the two public RPC functions)**
into this one file — they belong together since the RPC functions are what make the
RLS design actually usable from the public page.

```bash
npx supabase db push
```

Verify in **Supabase Dashboard → Table Editor**: all 7 tables present, RLS "Enabled" on
every one. Then go to **Database → Functions** and confirm `is_operator`,
`create_public_booking`, and `check_booking_by_phone` are all listed.

**Before moving on, re-run Supabase's Security Advisor** (Dashboard → Advisors) and
confirm `bookings` shows no anon-accessible policy warnings. This is the one thing in
this entire setup most worth double-checking manually — see the RLS section of
`CRM_MASTER_BUILD_PROMPT.md` for why.

---

## Phase 5 — Turn off public signup, set up invite-only auth

**In the browser** (Supabase Dashboard → Authentication):
1. Keep **Email** provider enabled
2. **Authentication → Settings** → turn **OFF** "Allow new users to sign up"
3. **Authentication → URL Configuration** → leave Site URL as `http://localhost:3000`
   for now, update in Phase 8

This only affects the operator login. The public booking page never uses Supabase Auth
at all — it calls the anon-permitted RPC functions directly, so turning off signup here
has no effect on customers' ability to book.

---

## Phase 6 — Connect Next.js to Supabase

```bash
npm install @supabase/supabase-js @supabase/ssr
```

`.env.local` (confirm `.gitignore` has `.env*.local`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

Ask Claude Code to generate, using the current `@supabase/ssr` pattern for App Router:
- `src/lib/supabase/client.ts` — browser client
- `src/lib/supabase/server.ts` — server client
- `src/middleware.ts` — session refresh

Also commit `.env.local.example` (same keys, no real values).

---

## Phase 7 — Test locally

```bash
npm run dev
```

Ask Claude Code for a throwaway `/test-connection` page: one query against `boats`
(should return `[]`, empty-but-no-error confirms the connection), and one call to
`supabase.rpc('check_booking_by_phone', { p_phone: '0000000000' })` (should return `[]`
too — confirms the RPC function is callable with the anon key before you build the real
UI on top of it). Delete this page once confirmed.

```bash
git add .
git commit -m "feat: connect Supabase client, add env template"
git push origin main
```

---

## Phase 8 — Deploy to Vercel

**Via the Vercel dashboard:**

1. https://vercel.com/new → **Import Git Repository** → `Malvisse-Silverhand/travelcrm-sakuratackle`
2. Framework Preset: Next.js (auto-detected)
3. Add all 3 env vars for **Production, Preview, and Development**
4. **Deploy**

Note the live URL, e.g. `https://travelcrm-sakuratackle.vercel.app`.

> **Known trap from the Prestige Legacy build**: if `/anything` 404s on the live URL
> despite the code being pushed, check **Project Settings → Environments →
> Production → Branch Tracking**. It locks to whatever branch was the repo's default
> at the moment of first import and does not auto-follow a later default-branch change.
> Since `travelcrm-sakuratackle` is already confirmed on `main` as its default branch,
> this shouldn't bite you here — but it's worth knowing if a future rename happens.

From here, every `git push` to `main` auto-deploys to production.

---

## Phase 9 — Post-deploy: allowlist the live URL + create your operator account

**Supabase Dashboard → Authentication → URL Configuration:**
1. Site URL → your Vercel URL
2. Add the same URL under Redirect URLs

**Create your operator account** (public signup is off):
1. **Authentication → Users → Add User** — your email + a temporary password
2. **Table Editor → profiles → Insert row**: `id` = that user's UUID, `full_name` =
   your name, `email` = same email, `role` = `operator`, `is_active` = true
3. Go to `/login` on the live URL, sign in
4. You're in as the operator

---

## Phase 10 — Custom domain (later, once stable)

**Vercel Dashboard → project → Settings → Domains** — add your domain (e.g.
`booking.sakuratackle.com` or similar), point the given CNAME/A record at it, wait for
propagation. Update Supabase's Site URL to match once it's live.

---

## Ongoing workflow

- **Schema changes**: always `supabase migration new <name>` → edit → `supabase db push`.
  Never click-edit in the dashboard once past initial setup.
- **Seasonal data**: `trip_nights` rows need to exist before a night is bookable —
  ask Claude Code to build a small "generate season" admin action (loop over the season
  date range × active boats, insert one row per combination) rather than inserting
  hundreds of rows by hand every year.
- **Secrets**: any new secret goes in Vercel → Settings → Environment Variables, and
  `supabase secrets set` for anything used inside an Edge Function (none needed yet in
  this phase since there's no webhook fan-out like Prestige Legacy's quotation capture).

---

## Quick command reference

```bash
npm run dev
npx supabase migration new <name>
npx supabase db push
vercel --prod
vercel env pull .env.local
```
