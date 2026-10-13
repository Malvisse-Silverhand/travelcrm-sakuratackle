import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

// Daily ping from Vercel Cron (vercel.json) that keeps the free-tier Supabase
// project from auto-pausing. Free projects pause after about a week without
// traffic; this one paused twice (18-30 Sep, then again from ~7 Oct), each time
// taking the booking calendar down until someone restored it by hand.
//
// Stopgap by the operator's choice. Supabase Pro removes the need for it; when
// that happens, delete this route and the cron entry together.
//
// It doubles as a daily health check: if the read fails, Sentry gets an event,
// so a pause (or any other outage) is noticed within a day instead of when a
// customer complains.

export async function GET(request: Request) {
  // Vercel sends `Authorization: Bearer <CRON_SECRET>` when that env var is
  // set. Enforced only when configured, so the ping still works before the
  // secret is added; the route is a single cheap read either way.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Publishable key on purpose: org_settings is publicly readable, and the
  // ping needs no more access than the homepage already has.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await supabase.from("org_settings").select("id").limit(1);

  if (error) {
    Sentry.captureException(new Error(`Keep-alive ping failed: ${error.message}`), {
      tags: { area: "keepalive" },
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
