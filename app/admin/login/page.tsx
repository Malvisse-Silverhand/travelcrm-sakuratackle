"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEmailLike, normalizePhoneLocal } from "@/lib/phone";
import styles from "../admin.module.css";

const GENERIC_ERROR = "Email/telefon atau kata laluan tidak sah.";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    setError(null);
    setLoading(true);

    const raw = identifier.trim();
    let loginEmail = raw;

    if (!isEmailLike(raw)) {
      // Phone login: resolve to the underlying email server-side (no SMS
      // provider involved — see supabase/migrations/*_operator_phone_login.sql).
      const { data: resolved, error: resolveError } = await supabase.rpc(
        "resolve_operator_login",
        { p_identifier: normalizePhoneLocal(raw) }
      );
      if (resolveError || !resolved) {
        setLoading(false);
        setError(GENERIC_ERROR);
        return;
      }
      loginEmail = resolved;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError(GENERIC_ERROR);
      return;
    }

    // A Supabase Auth account alone isn't enough — must also be an active
    // operator (invite-only). "read own profile" RLS scopes this to self.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Akaun ini bukan operator berdaftar.");
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.logoMark}>CS</div>
        <h2 className={styles.title}>Operator sign in</h2>
        <p className={styles.subtitle}>Sakura Tackle booking console</p>

        {error && <div className={styles.errorNote}>{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doLogin();
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
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata laluan"
            />
          </label>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className={styles.footNote}>Access is limited to registered boat operators.</p>
      </div>
    </div>
  );
}
