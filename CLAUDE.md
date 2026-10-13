@AGENTS.md

# Sakura Tackle booking system

Squid-jigging (candat sotong) night-trip booking site + operator CRM for
Sakura Tackle, Jeti Marang, Terengganu. Single operator, single tenant.
Live: https://sakuratacklebookingsystem.vercel.app (push to `main` deploys).

## Stack
Next.js 16 App Router (read `node_modules/next/dist/docs/` before using an
API — see AGENTS.md), React 19, TypeScript, Supabase (Postgres/Auth/RLS/
Storage), Sentry, Vercel. three.js via @react-three/fiber + drei for the 3D
fleet. **No Tailwind, no Remotion** (licence: >3 employees).

## Language rule
Customer-facing copy: bahasa rojak (Malay/English mix). Admin/backend UI,
code, comments, commits: **English only**.

## Brand tokens (app/globals.css)
purple `#2e1d6b` · gold `#ffb800` · ink `#1b1436` · page `#f5f2fe` ·
whatsapp `#128c7e` · lamp green `#5dff9c`. Fonts: Poppins (display), Inter
(body). Logo: `public/brand/logo-badge.webp`.

## Layout conventions
CSS Modules, **container queries** (not media queries): 980px and 620px on
public pages. Mobile-first; many customers book on mid-range Android.

## Where things are
- `app/page.tsx` homepage · `app/destinasi/terengganu` coast guide + map
- `components/public/*` booking calendar, form, Pembayaran, fleet
- `components/three/*` + `lib/fleet3d/specs.ts` low-poly boats; review page
  `/preview/armada?boat=&mode=&style=&pax=&still=1`
- `app/admin/(app)/*` operator console · `lib/booking/*` shared loaders
- `supabase/migrations/*` (applied with `npx supabase db push`)

## Rules that have bitten before
- **RLS:** `bookings` has no anon policy, ever. Public writes go through route
  handlers that call `verifyBookingOwner(ref, phone)` before using the
  service-role client (`lib/supabase/admin.ts`, server-only).
- **Write safety:** every update/delete chains `.select("id")` and checks the
  row count. RLS no-ops return no error.
- **Past nights:** `get_public_availability` must keep `night_date >=
  current_date`.
- **Free-tier Supabase pauses** after ~7 idle days. `/api/keepalive` (Vercel
  cron, 06:00 MYT) prevents it; if the site shows "sedang diselenggara",
  check `npx supabase projects list` first.
- **Test data:** delete every test booking/pax row/receipt you create; the DB
  holds real customer bookings.

## Commands
`npm run dev` · `npx tsc --noEmit` · `npm run build` ·
`npx eslint app components lib` (3 pre-existing errors on main).
Headless WebGL screenshots: Chrome `--headless=new --enable-unsafe-swiftshader
--use-angle=swiftshader --ignore-gpu-blocklist`.

## Roadmap
See memory `sakura-3d-roadmap`. Phase 1 (3D fleet) on branch `feat/fleet-3d`;
next: 2 homepage one-screen sections → 3 client portal, payments
(gateway placeholder), receipts → 4 Harbour HQ (Flotsam-style admin) + CRM.
