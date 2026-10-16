import { NextResponse } from "next/server";
import { normalizePhoneLocal } from "@/lib/phone";
import { EMAIL_RE, issueInvite, originOf, requireAdminApi, type InviteRole } from "@/lib/admin/invites";

// Invite an admin or a vendor. Returns the one-time link (also emailed when
// Resend is set up) and a ready WhatsApp message, because the link token is
// never stored and cannot be shown again later.

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let body: { fullName?: string; email?: string; phone?: string; role?: string; boatIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = body.phone ? normalizePhoneLocal(String(body.phone)) : "";
  const role: InviteRole = body.role === "vendor" ? "vendor" : body.role === "editor" ? "editor" : "admin";
  const boatIds = role === "vendor" && Array.isArray(body.boatIds) ? body.boatIds.map(String) : [];

  if (fullName.length < 2) return NextResponse.json({ error: "Enter their name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email; it is their sign-in." }, { status: 400 });
  if (phone && (phone.length < 9 || phone.length > 12)) {
    return NextResponse.json({ error: "That phone number looks wrong." }, { status: 400 });
  }
  if (role === "vendor" && boatIds.length === 0) {
    return NextResponse.json({ error: "Pick the boats this vendor manages." }, { status: 400 });
  }

  const result = await issueInvite({
    fullName,
    email,
    phone: phone || null,
    role,
    boatIds,
    actor: { id: me.id, name: me.name },
    origin: originOf(request),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
