import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken, logActivity } from "@/lib/admin/invites";

// Accept an invitation: the invitee sets a password, and the account,
// profile (role) and, for a vendor, boat ownership are created. Public — the
// token is the credential — so everything here is checked server-side with
// the service role, and only a hash of the token is ever compared.

const MIN_PASSWORD = 10;

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, full_name, email, phone, role, boat_ids, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite || invite.revoked_at) return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "This invitation was already used. Sign in instead." }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired. Ask an admin for a new link." }, { status: 410 });
  }

  // Create the sign-in, or reuse one that already exists for this email.
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name },
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === invite.email);
    if (!found) return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
    const upd = await admin.auth.admin.updateUserById(found.id, { password });
    if (upd.error) return NextResponse.json({ error: "Could not set the password." }, { status: 500 });
    userId = found.id;
  }

  // Phone is a sign-in alias and must be unique; drop it if already taken.
  let phone: string | null = invite.phone;
  if (phone) {
    const { data: clash } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
    if (clash && clash.id !== userId) phone = null;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: invite.full_name,
    email: invite.email,
    phone,
    role: invite.role,
    is_active: true,
  });
  if (profileError) return NextResponse.json({ error: "Could not create the profile." }, { status: 500 });

  if (invite.role === "vendor" && invite.boat_ids.length > 0) {
    await admin.from("boats").update({ vendor_id: userId }).in("id", invite.boat_ids).select("id");
  }

  const { data: done } = await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString(), accepted_user: userId })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id");
  if (!done?.length) return NextResponse.json({ error: "This invitation was already used." }, { status: 409 });

  await logActivity(
    { id: userId, name: invite.full_name },
    "user.joined",
    "user",
    userId!,
    `${invite.full_name} accepted the invitation (${invite.role === "vendor" ? "vendor" : "admin"})`
  );

  return NextResponse.json({ email: invite.email });
}
