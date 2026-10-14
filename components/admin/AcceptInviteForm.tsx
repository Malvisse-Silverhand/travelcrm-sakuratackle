"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../app/admin/admin.module.css";

export default function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(body.error ?? "Something went wrong. Try again.");
    }
    // Signed straight in with the password just chosen.
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setBusy(false);
      return setError("Account ready, but sign-in failed. Use the sign-in page.");
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && <div className={styles.errorNote}>{error}</div>}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Password again</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "Setting up…" : "Join Sakura Tackle"}
      </button>
    </form>
  );
}
