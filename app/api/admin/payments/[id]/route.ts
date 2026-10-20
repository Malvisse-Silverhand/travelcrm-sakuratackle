import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";
import { loadReceipt } from "@/lib/receipts/receipt";
import { emailReceipt, receiptWhatsappText } from "@/lib/receipts/send";
import { waToCustomer } from "@/lib/admin/waTemplates";

// One payment's receipt: email it (PDF attached), get the WhatsApp message
// (marks it sent), or void it with a reason. Receipt numbers are never
// reused, so voiding keeps the row.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let b: { action?: string; reason?: string };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Read through the admin's session first: RLS confirms access.
  const db = await createClient();
  const { data: row } = await db.from("payments").select("id, voided_at").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

  if (b.action === "email") {
    const r = await emailReceipt(id);
    return r.sent ? NextResponse.json({ ok: true, message: "Receipt emailed with the PDF." }) : NextResponse.json({ error: r.reason }, { status: 400 });
  }

  if (b.action === "whatsapp") {
    const r = await loadReceipt({ id });
    if (!r) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    if (r.voided) return NextResponse.json({ error: "A void receipt cannot be sent." }, { status: 400 });
    await db.from("payments").update({ whatsapped_at: new Date().toISOString() }).eq("id", id).select("id");
    return NextResponse.json({ ok: true, link: waToCustomer(r.booking.phone, receiptWhatsappText(r)) });
  }

  if (b.action === "void") {
    const reason = String(b.reason ?? "").trim().slice(0, 200);
    if (reason.length < 3) return NextResponse.json({ error: "Give a short reason." }, { status: 400 });
    if (row.voided_at) return NextResponse.json({ error: "Already void." }, { status: 409 });
    const { data } = await db.from("payments").update({ voided_at: new Date().toISOString(), void_reason: reason }).eq("id", id).select("id");
    if (!data?.length) return NextResponse.json({ error: "Not saved." }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Receipt voided." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
