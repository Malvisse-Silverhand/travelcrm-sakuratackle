import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvite, logActivity, originOf, requireAdminApi } from "@/lib/admin/invites";

// Review a vendor application. Approve sends the usual vendor invitation
// (optionally with boats already in the fleet); reject keeps the record with
// a note. Both can be undone only by a new application.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let body: { action?: string; boatIds?: string[]; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const note = String(body.note ?? "").trim().slice(0, 500) || null;

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("vendor_applications")
    .select("id, full_name, email, phone, status")
    .eq("id", id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (app.status === "approved") return NextResponse.json({ error: "Already approved." }, { status: 409 });

  const reviewed = { reviewed_by: me.id, reviewed_at: new Date().toISOString(), admin_note: note };

  if (body.action === "reject") {
    const { data } = await admin
      .from("vendor_applications")
      .update({ status: "rejected", ...reviewed })
      .eq("id", id)
      .select("id");
    if (!data?.length) return NextResponse.json({ error: "Not updated." }, { status: 500 });
    await logActivity(me, "vendor.rejected", "vendor_application", id, `Rejected ${app.full_name}'s vendor application`);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "approve") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  // Only boats that exist and have no vendor yet can be handed over.
  const wanted = Array.isArray(body.boatIds) ? body.boatIds.map(String) : [];
  const { data: free } = wanted.length
    ? await admin.from("boats").select("id").in("id", wanted).is("vendor_id", null)
    : { data: [] as { id: string }[] };

  const invite = await issueInvite({
    fullName: app.full_name,
    email: app.email,
    phone: app.phone,
    role: "vendor",
    boatIds: (free ?? []).map((b) => b.id),
    actor: me,
    origin: originOf(request),
  });
  if ("error" in invite) return NextResponse.json({ error: invite.error }, { status: invite.status });

  const { data } = await admin
    .from("vendor_applications")
    .update({ status: "approved", invite_id: invite.id, ...reviewed })
    .eq("id", id)
    .select("id");
  if (!data?.length) return NextResponse.json({ error: "Invitation sent, but the application was not updated." }, { status: 500 });
  await logActivity(me, "vendor.approved", "vendor_application", id, `Approved ${app.full_name}'s vendor application`);

  return NextResponse.json({ name: app.full_name, ...invite });
}
