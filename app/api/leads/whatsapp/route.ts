import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanPhone } from "@/lib/import/sheet";

// Public: the "WhatsApp Kami" opt-in form. Saves the visitor as a lead
// (source whatsapp) before WhatsApp opens, so the enquiry is not lost if they
// never press send. leads has no anon policy, so the input is checked here
// and written with the service role. One open lead per phone: a repeat click
// refreshes it instead of adding another.

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  // Bots fill the hidden field; tell them it worked and keep nothing.
  if (clip(b.website, 100)) return NextResponse.json({ ok: true });

  const name = clip(b.name, 120);
  const phone = cleanPhone(clip(b.phone, 20));
  if (name.length < 2 || !phone) return NextResponse.json({ error: "Sila isi nama dan no. telefon." }, { status: 400 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const date = clip(b.date, 10);
  const wantedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? date : null;
  const paxN = Math.round(Number(b.pax));
  const pax = paxN >= 1 && paxN <= 100 ? paxN : null;
  const page = clip(b.page, 80).replace(/[^\w/.-]/g, "") || "/";

  const db = createAdminClient();
  const { data: open } = await db
    .from("leads")
    .select("id, wanted_date, pax, notes")
    .eq("phone_key", phone)
    .not("stage", "in", "(won,lost)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    await db
      .from("leads")
      .update({
        wanted_date: wantedDate ?? open.wanted_date,
        pax: pax ?? open.pax,
        next_follow_up: today,
        notes: `${open.notes ? `${open.notes}\n` : ""}${today}: clicked WhatsApp Kami again (${page})`.slice(-2000),
      })
      .eq("id", open.id)
      .select("id");
    return NextResponse.json({ ok: true });
  }

  const { error } = await db
    .from("leads")
    .insert({
      name,
      phone,
      phone_key: phone,
      source: "whatsapp",
      wanted_date: wantedDate,
      pax,
      notes: `Clicked WhatsApp Kami on ${page}`,
      next_follow_up: today,
    })
    .select("id");
  if (error) return NextResponse.json({ error: "Tak dapat simpan. WhatsApp tetap boleh dibuka." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
