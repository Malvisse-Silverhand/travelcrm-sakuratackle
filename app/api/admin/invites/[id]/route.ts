import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import {
  INVITE_DAYS,
  inviteLink,
  inviteMessage,
  logActivity,
  newInviteToken,
  originOf,
  requireAdminApi,
  whatsappLink,
} from "@/lib/admin/invites";

// Revoke an invitation, or renew it: a fresh link (the old one stops
// working) and a fresh 7 days, re-sent by email when Resend is set up.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let action = "";
  try {
    action = String((await request.json()).action ?? "");
  } catch {}

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, full_name, email, phone, role, accepted_at, revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "Already accepted." }, { status: 409 });

  if (action === "revoke") {
    const { data } = await admin
      .from("invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (!data?.length) return NextResponse.json({ error: "Not updated." }, { status: 500 });
    await logActivity({ id: me.id, name: me.name }, "user.invite_revoked", "user", id, `Revoked the invitation for ${invite.full_name}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "renew") {
    const { token, hash } = newInviteToken();
    const { data } = await admin
      .from("invites")
      .update({
        token_hash: hash,
        revoked_at: null,
        expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
      })
      .eq("id", id)
      .select("id");
    if (!data?.length) return NextResponse.json({ error: "Not updated." }, { status: 500 });
    const role = invite.role === "vendor" ? "vendor" : "admin";
    const link = inviteLink(originOf(request), token);
    const message = inviteMessage(invite.full_name, role, link);
    const sent = await sendEmail({
      to: invite.email,
      subject: "Your Sakura Tackle invitation",
      text: message,
      html: `<p>${message.replace(link, `<a href="${link}">${link}</a>`)}</p>`,
    });
    await logActivity({ id: me.id, name: me.name }, "user.invite_renewed", "user", id, `Renewed the invitation for ${invite.full_name}`);
    return NextResponse.json({
      link,
      whatsapp: whatsappLink(invite.phone, message),
      emailed: sent.sent,
      emailError: sent.error ?? null,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
