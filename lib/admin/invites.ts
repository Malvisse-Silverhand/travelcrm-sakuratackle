import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { waNumber } from "@/lib/phone";

/** How long an invitation link works. */
export const INVITE_DAYS = 7;

export type InviteRole = "admin" | "vendor";

/** The database calls admins 'operator' (the original single role). */
export const dbRole = (r: InviteRole) => (r === "admin" ? "operator" : "vendor");

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
  const what = role === "admin" ? "an admin" : "a vendor (your boats' bookings and calendar)";
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
