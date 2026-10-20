import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";

// Undo an import: delete exactly what it added (customers and past trips, or
// leads that were not worked on since), and mark the batch undone.

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  const db = await createClient();
  const { data: batch } = await db.from("import_batches").select("id, kind, undone_at").eq("id", id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "Import not found." }, { status: 404 });
  if (batch.undone_at) return NextResponse.json({ error: "Already undone." }, { status: 409 });

  let kept = 0;
  if (batch.kind === "customers") {
    await db.from("past_trips").delete().eq("import_batch", id).select("id");
    await db.from("customers").delete().eq("import_batch", id).select("id");
  } else {
    // Leads someone already moved on are kept; only untouched ones go.
    await db.from("leads").delete().eq("import_batch", id).eq("stage", "new").select("id");
    const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("import_batch", id);
    kept = count ?? 0;
  }
  const { data } = await db.from("import_batches").update({ undone_at: new Date().toISOString() }).eq("id", id).select("id");
  if (!data?.length) return NextResponse.json({ error: "Nothing was changed." }, { status: 500 });
  return NextResponse.json({ ok: true, kept });
}
