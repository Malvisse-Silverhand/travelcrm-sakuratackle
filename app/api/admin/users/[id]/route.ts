import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, requireAdminApi } from "@/lib/admin/invites";

// Turn a team member's access on or off, or change a vendor's boats.
// Accounts are never deleted (bookings and the activity log refer to them).

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let body: { active?: boolean; boatIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (typeof body.active === "boolean") {
    if (id === me.id && !body.active) {
      return NextResponse.json({ error: "You cannot switch off your own access." }, { status: 400 });
    }
    if (!body.active && target.role === "operator") {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "operator")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "There must always be at least one active admin." }, { status: 400 });
      }
    }
    const { data } = await admin.from("profiles").update({ is_active: body.active }).eq("id", id).select("id");
    if (!data?.length) return NextResponse.json({ error: "Not updated." }, { status: 500 });
    await logActivity(
      { id: me.id, name: me.name },
      "user.updated",
      "user",
      id,
      `${target.full_name}: access ${body.active ? "switched on" : "switched off"}`
    );
  }

  if (Array.isArray(body.boatIds) && target.role === "vendor") {
    const boatIds = body.boatIds.map(String);
    // Release boats no longer theirs, then assign the chosen ones.
    await admin.from("boats").update({ vendor_id: null }).eq("vendor_id", id).select("id");
    if (boatIds.length > 0) {
      const { data } = await admin.from("boats").update({ vendor_id: id }).in("id", boatIds).select("id");
      if ((data?.length ?? 0) !== boatIds.length) {
        return NextResponse.json({ error: "Some boats were not assigned." }, { status: 500 });
      }
    }
    await logActivity({ id: me.id, name: me.name }, "user.updated", "user", id, `${target.full_name}: boats updated (${boatIds.length})`);
  }

  return NextResponse.json({ ok: true });
}
