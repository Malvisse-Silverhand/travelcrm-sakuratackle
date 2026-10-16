import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { isEmailLike, normalizePhoneLocal } from "@/lib/phone";
import { escapeHtml, logActivity, originOf } from "@/lib/admin/invites";

// Forgot password for the admin console. Public: the reply is the same
// whether or not the account exists, so it cannot be used to find out who
// has one. The link carries a Supabase recovery token (hashed_token), which
// /admin/reset exchanges for a session only when the new password is
// submitted, so email link scanners that open the page do not use it up.

const OK = { ok: true };
/** One email per account per this many minutes. */
const THROTTLE_MIN = 2;

export async function POST(request: Request) {
  let body: { identifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const raw = String(body.identifier ?? "").trim();
  if (!raw || raw.length > 160) return NextResponse.json({ error: "Enter your email or phone." }, { status: 400 });

  const admin = createAdminClient();
  const query = admin.from("profiles").select("id, full_name, email, is_active");
  const { data: profile } = await (isEmailLike(raw)
    ? query.eq("email", raw.toLowerCase())
    : query.eq("phone", normalizePhoneLocal(raw))
  ).maybeSingle();
  if (!profile?.is_active || !profile.email) return NextResponse.json(OK);

  const since = new Date(Date.now() - THROTTLE_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "user.password_reset_requested")
    .eq("entity_id", profile.id)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return NextResponse.json(OK);

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: profile.email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return NextResponse.json(OK);

  const link = `${originOf(request).replace(/\/$/, "")}/admin/reset?token=${encodeURIComponent(hashed)}`;
  const name = profile.full_name || "there";
  await sendEmail({
    to: profile.email,
    subject: "Reset your Sakura Tackle password",
    text: `Salam ${name}, someone asked to reset the password for your Sakura Tackle console account. Set a new password here (the link works for 1 hour): ${link}\n\nIf this wasn't you, ignore this email; your password stays the same.`,
    html: `<p>Salam ${escapeHtml(name)},</p><p>Someone asked to reset the password for your Sakura Tackle console account.</p><p><a href="${link}">Set a new password</a> — the link works for 1 hour.</p><p>If this wasn't you, ignore this email; your password stays the same.</p>`,
  });

  await logActivity(
    { id: null, name: "System" },
    "user.password_reset_requested",
    "user",
    profile.id,
    `Password reset link sent to ${profile.full_name}`
  );

  return NextResponse.json(OK);
}
