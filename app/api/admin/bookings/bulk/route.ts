import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { runBookingAction } from "@/lib/booking/runAction";
import type { ActionKey } from "@/lib/booking/actions";

// Bulk actions from the Bookings list. Each booking goes through the same
// checks as a single action, so ones the action does not fit are skipped.

const BULK: ActionKey[] = ["weather_hold", "complete", "no_show"];
const MAX = 100;

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let body: { ids?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const action = String(body.action ?? "") as ActionKey;
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, MAX) : [];
  if (!BULK.includes(action) || ids.length === 0) {
    return NextResponse.json({ error: "Pick bookings and an action." }, { status: 400 });
  }

  let done = 0;
  let skipped = 0;
  for (const id of ids) {
    const r = await runBookingAction(id, { action }, me.id);
    if (r.ok) done += 1;
    else skipped += 1;
  }
  return NextResponse.json({ done, skipped });
}
