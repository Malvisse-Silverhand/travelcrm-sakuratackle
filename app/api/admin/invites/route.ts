import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { normalizePhoneLocal } from "@/lib/phone";
import {
  EMAIL_RE,
  INVITE_DAYS,
  dbRole,
  inviteLink,
  inviteMessage,
  logActivity,
  newInviteToken,
  originOf,
  requireAdminApi,
  whatsappLink,
  roleWithArticle,
  type InviteRole,
} from "@/lib/admin/invites";

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

  const admin = createAdminClient();

  // Already on the team?
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "That email already has an account." }, { status: 409 });

  // One live invite per email: older unaccepted ones are revoked.
  await admin
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");

  const { token, hash } = newInviteToken();
  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      full_name: fullName,
      email,
      phone: phone || null,
      role: dbRole(role),
      boat_ids: boatIds,
      token_hash: hash,
      created_by: me.id,
      expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !invite) return NextResponse.json({ error: "Could not create the invitation." }, { status: 500 });

  const link = inviteLink(originOf(request), token);
  const message = inviteMessage(fullName, role, link);
  const email_ = await sendEmail({
    to: email,
    subject: "You're invited to Sakura Tackle",
    text: message,
    html: `<p>Salam ${escapeHtml(fullName)},</p><p>You're invited to the Sakura Tackle booking system as ${
      roleWithArticle(role)
    }.</p><p><a href="${link}">Set your password</a> — the link works for ${INVITE_DAYS} days.</p>`,
  });

  await logActivity(
    { id: me.id, name: me.name },
    "user.invited",
    "user",
    invite.id,
    `Invited ${fullName} (${email}) as ${role}`
  );

  return NextResponse.json({
    id: invite.id,
    link,
    whatsapp: whatsappLink(phone || null, message),
    emailed: email_.sent,
    emailError: email_.error ?? null,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
