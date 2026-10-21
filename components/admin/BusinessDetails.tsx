"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../app/admin/admin.module.css";

export type BusinessInfo = {
  business_name: string;
  legal_name: string | null;
  ssm_no: string | null;
  sst_no: string | null;
  address: string | null;
  business_email: string | null;
};

const FIELDS: Array<{ key: keyof BusinessInfo; label: string; hint: string; max: number }> = [
  { key: "business_name", label: "Trading name", hint: "Big name at the top of every receipt", max: 120 },
  { key: "legal_name", label: "Registered company name", hint: "As on your SSM certificate, if different", max: 120 },
  { key: "ssm_no", label: "SSM registration no.", hint: "e.g. 202301234567 (SA0123456-X)", max: 40 },
  { key: "sst_no", label: "SST registration no.", hint: "Only if registered; adds an SST line", max: 40 },
  { key: "address", label: "Business address", hint: "Printed under the logo", max: 300 },
  { key: "business_email", label: "Business email", hint: "Shown in the receipt footer", max: 254 },
];

/** Business details printed on official receipts (org_settings). */
export default function BusinessDetails({ initial }: { initial: BusinessInfo }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (!f.business_name.trim()) return setMsg({ ok: false, text: "The trading name cannot be empty." });
    if (f.business_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.business_email.trim())) {
      return setMsg({ ok: false, text: "Check the email address." });
    }
    setBusy(true);
    setMsg(null);
    const clean = (v: string | null) => (v ?? "").trim() || null;
    const { data, error } = await createClient()
      .from("org_settings")
      .update({
        business_name: f.business_name.trim(),
        legal_name: clean(f.legal_name),
        ssm_no: clean(f.ssm_no),
        sst_no: clean(f.sst_no),
        address: clean(f.address),
        business_email: clean(f.business_email),
      })
      .eq("id", 1)
      .select("id");
    setBusy(false);
    setMsg(error || !data?.length ? { ok: false, text: "Not saved. Try again." } : { ok: true, text: "Saved. New and existing receipts show these details." });
  };

  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>Business details for receipts</span>
      <div className={styles.builderFields} style={{ marginTop: 12 }}>
        {FIELDS.map((x) => (
          <label key={x.key} className={styles.field} htmlFor={`biz-${x.key}`}>
            <span className={styles.fieldLabel}>{x.label}</span>
            <input
              id={`biz-${x.key}`}
              className={styles.input}
              value={f[x.key] ?? ""}
              maxLength={x.max}
              placeholder={x.hint}
              onChange={(e) => setF({ ...f, [x.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className={styles.markPaidBtn} style={{ margin: 0 }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save business details"}
        </button>
        {msg && <span className={msg.ok ? styles.formOk : styles.formErr}>{msg.text}</span>}
      </div>
    </div>
  );
}
