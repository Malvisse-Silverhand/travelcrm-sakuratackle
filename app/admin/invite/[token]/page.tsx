import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/admin/invites";
import AcceptInviteForm from "@/components/admin/AcceptInviteForm";
import styles from "../../admin.module.css";

// Opened from the invitation email or WhatsApp message, before the invitee
// has an account (the proxy lets /admin/invite/* through without a session).

export const metadata = { title: "Join Sakura Tackle" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("full_name, email, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  const problem = !invite || invite.revoked_at
    ? "This invitation link is not valid. Ask an admin to send a new one."
    : invite.accepted_at
      ? "This invitation was already used. Sign in instead."
      : new Date(invite.expires_at) < new Date()
        ? "This invitation has expired. Ask an admin to send a new link."
        : null;

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.webp" alt="Sakura Tackle" width={56} height={56} className={styles.logoMark} />
        {problem || !invite ? (
          <>
            <h2 className={styles.title}>Invitation</h2>
            <p className={styles.subtitle}>{problem}</p>
            <Link href="/admin/login" className={styles.submit} style={{ display: "block", textAlign: "center" }}>
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Welcome, {invite.full_name}</h2>
            <p className={styles.subtitle}>
              You&apos;re joining Sakura Tackle as {invite.role === "vendor" ? "a vendor" : "an admin"}.
              Choose a password for {invite.email}.
            </p>
            <AcceptInviteForm token={token} email={invite.email} />
          </>
        )}
      </div>
    </div>
  );
}
