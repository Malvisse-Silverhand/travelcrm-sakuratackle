import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";
import { cleanPhone } from "@/lib/import/sheet";
import { LEAD_SOURCES } from "@/lib/leads";

// Quick add a lead (WhatsApp, phone, Facebook… enquiries). Written through
// the admin's own session; the leads trigger logs it.

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const name = String(b.name ?? "").trim().slice(0, 120);
  const phone = cleanPhone(String(b.phone ?? ""));
  const source = String(b.source ?? "manual");
  const date = String(b.wantedDate ?? "");
  const pax = Number(b.pax);
  if (name.length < 2) return NextResponse.json({ error: "Enter their name." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a Malaysian phone number." }, { status: 400 });
  if (!(source in LEAD_SOURCES) || source === "expired_hold" || source === "import") {
    return NextResponse.json({ error: "Pick where they came from." }, { status: 400 });
  }

  const db = await createClient();
  const { data: open } = await db
    .from("leads")
    .select("id")
    .eq("phone_key", phone)
    .not("stage", "in", "(won,lost)")
    .limit(1);
  if (open?.length) {
    return NextResponse.json({ error: "This phone already has an open lead.", id: open[0].id }, { status: 409 });
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      name,
      phone,
      phone_key: phone,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email ?? "")) ? String(b.email).toLowerCase() : null,
      source,
      wanted_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      pax: pax >= 1 && pax <= 100 ? Math.round(pax) : null,
      notes: String(b.notes ?? "").trim().slice(0, 2000) || null,
      next_follow_up: /^\d{4}-\d{2}-\d{2}$/.test(String(b.followUp ?? "")) ? String(b.followUp) : null,
      owner: me.id,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "The lead was not saved. Try again." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
