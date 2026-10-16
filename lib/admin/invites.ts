import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { waNumber } from "@/lib/phone";
import { sendEmail } from "@/lib/email/resend";

/** How long an invitation link works. */
export const INVITE_DAYS = 7;

export type InviteRole = "admin" | "vendor" | "editor";

/** The database calls admins 'operator' (the original single role). */
export const dbRole = (r: InviteRole) => (r === "admin" ? "operator" : r);

/** Database role -> invite/console role. Unknown values are not admin. */
export function fromDbRole(r: string | null | undefined): InviteRole {
  if (r === "operator") return "admin";
  if (r === "editor") return "editor";
  return "vendor";
}

/** "an admin", "a vendor", "an editor". */
export function roleWithArticle(r: InviteRole): string {
  return r === "admin" ? "an admin" : r === "editor" ? "an editor" : "a vendor";
}

/** A new link token and the hash that is stored. The token itself is shown
 *  once (to the inviting admin, in the email and WhatsApp text) and never
 *  saved. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/admin/invite/${token}`;
}

export function inviteMessage(name: string, role: InviteRole, link: string): string {
  const what =
    role === "admin"
      ? "an admin"
      : role === "editor"
        ? "an editor (you build and edit the website's pages)"
        : "a vendor (your boats' bookings and calendar)";
  return `Salam ${name}, you're invited to the Sakura Tackle booking system as ${what}. Set your password here (link works for ${INVITE_DAYS} days): ${link}`;
}

export function whatsappLink(phone: string | null, text: string): string {
  const to = phone ? waNumber(phone) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** The site's own origin, for links: the request's, so previews link to
 *  the preview and production to production. */
export function originOf(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/** For admin API routes: the signed-in admin, or a 401/403 response. Uses
 *  the caller's own session (RLS "read own profile"), never the service
 *  role, to decide who they are. */
export async function requireAdminApi(): Promise<
  { ok: true; id: string; name: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) return { ok: false, response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!profile?.is_active || profile.role !== "operator") {
    return { ok: false, response: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { ok: true, id, name: profile.full_name };
}

/** Activity rows for changes made through the service role, where the
 *  database triggers cannot see who did it. */
export async function logActivity(
  actor: { id: string | null; name: string },
  action: string,
  entity: string,
  entityId: string,
  summary: string
) {
  const admin = createAdminClient();
  await admin.from("activity_log").insert({
    actor_id: actor.id,
    actor_name: actor.name,
    action,
    entity,
    entity_id: entityId,
    summary,
  });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type IssuedInvite = {
  id: string;
  link: string;
  whatsapp: string;
  emailed: boolean;
  emailError: string | null;
};

/** Create an invitation (revoking older open ones for the email), email it
 *  when Resend is set up, and log it. Inputs must already be validated. */
export async function issueInvite(input: {
  fullName: string;
  email: string;
  phone: string | null;
  role: InviteRole;
  boatIds: string[];
  actor: { id: string; name: string };
  origin: string;
}): Promise<IssuedInvite | { error: string; status: number }> {
  const { fullName, email, phone, role, boatIds, actor, origin } = input;
  const admin = createAdminClient();

  // Already on the team?
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return { error: "That email already has an account.", status: 409 };

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
      phone,
      role: dbRole(role),
      boat_ids: boatIds,
      token_hash: hash,
      created_by: actor.id,
      expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !invite) return { error: "Could not create the invitation.", status: 500 };

  const link = inviteLink(origin, token);
  const message = inviteMessage(fullName, role, link);
  const mail = await sendEmail({
    to: email,
    subject: "You're invited to Sakura Tackle",
    text: message,
    html: `<p>Salam ${escapeHtml(fullName)},</p><p>You're invited to the Sakura Tackle booking system as ${roleWithArticle(
      role
    )}.</p><p><a href="${link}">Set your password</a> — the link works for ${INVITE_DAYS} days.</p>`,
  });

  await logActivity(actor, "user.invited", "user", invite.id, `Invited ${fullName} (${email}) as ${role}`);

  return {
    id: invite.id,
    link,
    whatsapp: whatsappLink(phone, message),
    emailed: mail.sent,
    emailError: mail.error ?? null,
  };
}
