import { fromDbRole } from "@/lib/admin/invites";
import { requireAdmin } from "@/lib/admin/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/admin/PageHeader";
import UsersPanel, { type InviteRow, type UserRow } from "@/components/admin/UsersPanel";
import { emailConfigured } from "@/lib/email/resend";
import styles from "../../admin.module.css";

export default async function UsersPage() {
  // Admin-only, checked against the caller's own session before the
  // service role is used to read everyone's profile.
  const profile = await requireAdmin();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: boats }, { data: invites }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone, role, is_active, created_at").order("created_at"),
    admin.from("boats").select("id, code, vendor_id, active").order("sort_order").order("code"),
    admin
      .from("invites")
      .select("id, full_name, email, phone, role, boat_ids, created_at, expires_at, accepted_at, revoked_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const codeOf = new Map((boats ?? []).map((b) => [b.id, b.code]));
  const users: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    phone: p.phone,
    role: fromDbRole(p.role),
    active: p.is_active,
    me: p.id === profile.userId,
    boatIds: (boats ?? []).filter((b) => b.vendor_id === p.id).map((b) => b.id),
  }));
  const pending: InviteRow[] = (invites ?? []).map((i) => ({
    id: i.id,
    name: i.full_name,
    email: i.email,
    phone: i.phone,
    role: fromDbRole(i.role),
    boats: (i.boat_ids as string[]).map((id) => codeOf.get(id) ?? "?"),
    expiresAt: i.expires_at,
  }));

  return (
    <>
      <PageHeader
        title="Users & roles"
        subtitle={`${users.filter((u) => u.active).length} active · ${pending.length} invitation${pending.length === 1 ? "" : "s"} pending`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <UsersPanel
          users={users}
          invites={pending}
          boats={(boats ?? []).map((b) => ({ id: b.id, code: b.code, active: b.active, vendorId: b.vendor_id }))}
          emailReady={emailConfigured()}
        />
      </div>
    </>
  );
}
