"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../app/admin/admin.module.css";

const MIN_PASSWORD = 10;

/** Set a new password from a reset link's recovery token. */
export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const supabase = createClient();
    // The token is used only now, so opening the link does not spend it.
    const { error: verifyError } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: token });
    if (verifyError) {
      setBusy(false);
      return setError("This reset link has expired or was already used. Ask for a new one.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      return setError(
        updateError.message.toLowerCase().includes("different")
          ? "Choose a password different from your old one."
          : "Could not save the new password. Ask for a new link and try again."
      );
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.webp" alt="Sakura Tackle" width={56} height={56} className={styles.logoMark} />
        <h2 className={styles.title}>Set a new password</h2>
        {!token ? (
          <>
            <p className={styles.subtitle}>This reset link is incomplete. Ask for a new one.</p>
            <Link href="/admin/forgot" className={styles.submit} style={{ display: "block", textAlign: "center" }}>
              Get a new link
            </Link>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>Choose a new password for the Sakura Tackle console.</p>
            {error && <div className={styles.errorNote}>{error}</div>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>New password</span>
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>New password again</span>
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
            <p className={styles.footNote}>
              <Link href="/admin/forgot">Get a new link</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
