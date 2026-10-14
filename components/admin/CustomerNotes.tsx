"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CUSTOMER_TAGS } from "@/lib/admin/customers";
import styles from "../../app/admin/admin.module.css";

/** Notes and tags on a customer, keyed by their phone number. */
export default function CustomerNotes({
  phoneKey,
  initialNotes,
  initialTags,
}: {
  phoneKey: string;
  initialNotes: string;
  initialTags: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = notes !== initialNotes || tags.join("|") !== initialTags.join("|");

  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    // RLS no-ops come back without an error, so the row must come back too.
    const { data, error } = await supabase
      .from("customer_notes")
      .upsert({ phone_key: phoneKey, notes: notes.trim(), tags, updated_at: new Date().toISOString() })
      .select("phone_key");
    setBusy(false);
    if (error || !data?.length) {
      setMsg({ ok: false, text: "Not saved. Try again." });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  };

  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>Notes &amp; tags</span>
      <div className={styles.tagRow} style={{ margin: "12px 0" }}>
        {CUSTOMER_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tags.includes(t)}
            className={`${styles.tagToggle} ${tags.includes(t) ? styles.tagToggleOn : ""}`}
            onClick={() => toggle(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <textarea
        className={styles.textarea}
        rows={4}
        style={{ width: "100%" }}
        placeholder="e.g. Prefers TRF 1005; brings own jigs; ask about the corporate trip in March."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className={styles.builderSaveRow} style={{ marginTop: 10 }}>
        {msg && <span className={msg.ok ? styles.formOk : styles.formErr}>{msg.text}</span>}
        <button
          type="button"
          className={styles.markPaidBtn}
          style={{ width: "auto", margin: "0 0 0 auto" }}
          disabled={busy || !dirty}
          onClick={save}
        >
          {busy ? "Saving…" : "Save notes"}
        </button>
      </div>
    </div>
  );
}
