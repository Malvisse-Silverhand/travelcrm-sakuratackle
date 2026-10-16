"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "../admin.module.css";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!identifier.trim()) return setError("Enter your email or phone.");
    setBusy(true);
    const res = await fetch("/api/admin/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Something went wrong. Try again.");
    }
    setSent(true);
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.webp" alt="Sakura Tackle" width={56} height={56} className={styles.logoMark} />
        <h2 className={styles.title}>Forgot password</h2>
        {sent ? (
          <>
            <p className={styles.subtitle}>
              If that account exists, a reset link is on its way to the account&apos;s email. It works for 1 hour.
              Check your spam folder too.
            </p>
            <Link href="/admin/login" className={styles.submit} style={{ display: "block", textAlign: "center" }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>We&apos;ll email you a link to set a new password.</p>
            {error && <div className={styles.errorNote}>{error}</div>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Phone or email</span>
                <input
                  className={styles.input}
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="operator@sakuratackle.com atau 0123456789"
                />
              </label>
              <button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className={styles.footNote}>
              <Link href="/admin/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
