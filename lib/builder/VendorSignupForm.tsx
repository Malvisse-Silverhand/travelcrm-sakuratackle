"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./blocks.module.css";

type Jetty = { id: string; name: string };

type Props = {
  title: string;
  text: string;
  button: string;
  success: string;
  /** In the page builder: the form shows but does not send. */
  editing?: boolean;
  /** The page's slug, saved with the application. */
  source?: string;
};

const EMPTY = {
  fullName: "",
  business: "",
  phone: "",
  email: "",
  jetty: "",
  boatCount: "1",
  boats: "",
  message: "",
  consent: false,
  website: "", // honeypot: people never see or fill it
};

/** Public "register as a vendor" form. Posts to /api/vendor-applications;
 *  an admin reviews it in Admin → Vendor applications. */
export default function VendorSignupForm({ title, text, button, success, editing, source }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [jetties, setJetties] = useState<Jetty[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("jetties")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) => setJetties(data ?? []));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (editing) return setError("Preview sahaja: borang ini dihantar di laman sebenar.");
    if (form.fullName.trim().length < 2) return setError("Sila isi nama penuh.");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("Sila isi no. telefon yang betul.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Sila isi email yang betul.");
    if (!form.consent) return setError("Sila tanda kotak persetujuan.");
    setBusy(true);
    const res = await fetch("/api/vendor-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, boatCount: Number(form.boatCount), source }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setError(body.error ?? "Tak dapat hantar. Cuba lagi sekejap.");
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className={styles.vendorForm}>
        <h3 className={styles.ctaTitle}>Terima kasih!</h3>
        <p className={styles.ctaText}>{success}</p>
      </div>
    );
  }

  return (
    <form
      className={styles.vendorForm}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {title && <h3 className={styles.ctaTitle}>{title}</h3>}
      {text && <p className={styles.ctaText}>{text}</p>}

      <div className={styles.vfGrid}>
        <label className={styles.vfField}>
          <span>Nama penuh *</span>
          <input value={form.fullName} onChange={set("fullName")} autoComplete="name" maxLength={80} />
        </label>
        <label className={styles.vfField}>
          <span>Nama syarikat / bot</span>
          <input value={form.business} onChange={set("business")} autoComplete="organization" maxLength={120} />
        </label>
        <label className={styles.vfField}>
          <span>No. telefon (WhatsApp) *</span>
          <input value={form.phone} onChange={set("phone")} type="tel" autoComplete="tel" inputMode="tel" maxLength={20} placeholder="0123456789" />
        </label>
        <label className={styles.vfField}>
          <span>Email *</span>
          <input value={form.email} onChange={set("email")} type="email" autoComplete="email" maxLength={160} />
        </label>
        <label className={styles.vfField}>
          <span>Jeti / lokasi</span>
          <select value={form.jetty} onChange={set("jetty")}>
            <option value="">Pilih jeti</option>
            {jetties.map((j) => (
              <option key={j.id} value={j.name}>
                {j.name}
              </option>
            ))}
            <option value="Lain-lain">Lain-lain (nyatakan dalam mesej)</option>
          </select>
        </label>
        <label className={styles.vfField}>
          <span>Berapa bot?</span>
          <input value={form.boatCount} onChange={set("boatCount")} type="number" min={1} max={50} inputMode="numeric" />
        </label>
      </div>
      <label className={styles.vfField}>
        <span>Butiran bot</span>
        <textarea
          value={form.boats}
          onChange={set("boats")}
          rows={3}
          maxLength={1000}
          placeholder="No. pendaftaran, kapasiti (pax), panjang bot, tahun pengalaman kapten"
        />
      </label>
      <label className={styles.vfField}>
        <span>Mesej</span>
        <textarea value={form.message} onChange={set("message")} rows={3} maxLength={1000} />
      </label>
      <input
        className={styles.vfHoney}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={set("website")}
      />
      <label className={styles.vfConsent}>
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
        />
        Saya setuju Sakura Tackle simpan maklumat ini dan hubungi saya tentang permohonan vendor.
      </label>
      {error && <p className={styles.vfError}>{error}</p>}
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
        {busy ? "Menghantar…" : button}
      </button>
    </form>
  );
}
