import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";

// Record a payment by hand (cash at the jetty, DuitNow, a top-up…) with an
// optional proof file already uploaded to the private receipts bucket.
// Deposits, balances and refunds marked through the booking actions are
// recorded automatically; this is for anything else.

const KINDS = ["deposit", "full", "balance", "other"];
const METHODS = ["bank_transfer", "duitnow", "cash", "card", "online", "other"];

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const bookingId = String(b.bookingId ?? "");
  const kind = String(b.kind ?? "other");
  const method = String(b.method ?? "cash");
  const amount = Math.round(Number(b.amount) * 100) / 100;
  const paidAt = String(b.paidAt ?? "");
  const proof = b.proofPath ? String(b.proofPath) : null;
  if (!/^[0-9a-f-]{36}$/.test(bookingId)) return NextResponse.json({ error: "Bad booking." }, { status: 400 });
  if (!KINDS.includes(kind) || !METHODS.includes(method)) return NextResponse.json({ error: "Pick the type and method." }, { status: 400 });
  if (!(amount > 0 && amount <= 100000)) return NextResponse.json({ error: "Enter the amount in RM." }, { status: 400 });
  if (proof && (!proof.startsWith(`${bookingId}/`) || proof.length > 300)) {
    return NextResponse.json({ error: "Bad proof file." }, { status: 400 });
  }
  const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(paidAt) ? new Date(`${paidAt.slice(0, 16)}:00+08:00`).toISOString() : new Date().toISOString();

  const db = await createClient();
  const { data, error } = await db
    .from("payments")
    .insert({
      booking_id: bookingId,
      kind,
      method,
      amount,
      paid_at: at,
      proof_path: proof,
      note: String(b.note ?? "").trim().slice(0, 500) || null,
      created_by: me.id,
    })
    .select("id, receipt_no")
    .single();
  if (error || !data) return NextResponse.json({ error: "The payment was not saved." }, { status: 500 });
  return NextResponse.json({ id: data.id, receiptNo: data.receipt_no });
}
