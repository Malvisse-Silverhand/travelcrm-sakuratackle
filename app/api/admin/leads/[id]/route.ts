import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";
import { LOST_REASONS, type LeadStage } from "@/lib/leads";

// Move a lead along the board, or set its follow-up date and notes.
// Won needs the booking it became (the New booking form sends it); Lost
// needs a reason.

const STAGES: LeadStage[] = ["new", "contacted", "quoted", "won", "lost"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let b: { stage?: string; lostReason?: string; bookingId?: string; followUp?: string | null; notes?: string };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  if (b.stage !== undefined) {
    const stage = b.stage as LeadStage;
    if (!STAGES.includes(stage)) return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    fields.stage = stage;
    if (stage === "lost") {
      const reason = String(b.lostReason ?? "").trim();
      if (!LOST_REASONS.includes(reason) && reason.length < 3) {
        return NextResponse.json({ error: "Pick why the lead was lost." }, { status: 400 });
      }
      fields.lost_reason = reason.slice(0, 200);
    } else fields.lost_reason = null;
    if (stage === "won") {
      if (!/^[0-9a-f-]{36}$/.test(String(b.bookingId ?? ""))) {
        return NextResponse.json({ error: "A lead is won through its booking." }, { status: 400 });
      }
      fields.booking_id = b.bookingId;
      fields.next_follow_up = null;
    }
  }
  if (b.followUp !== undefined) {
    fields.next_follow_up = b.followUp && /^\d{4}-\d{2}-\d{2}$/.test(b.followUp) ? b.followUp : null;
  }
  if (b.notes !== undefined) fields.notes = String(b.notes).trim().slice(0, 2000) || null;
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const db = await createClient();
  const { data, error } = await db.from("leads").update(fields).eq("id", id).select("id");
  if (error || !data?.length) return NextResponse.json({ error: "Nothing was saved. Reload and try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
