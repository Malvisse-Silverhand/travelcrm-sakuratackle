"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import styles from "./book.module.css";

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload a bank-transfer receipt for a booking. Goes through /api/receipt,
 *  which proves the reference and phone belong together before it touches
 *  the service-role key (bookings has no anon policy). When the booking was
 *  just made on this device both are known and the fields stay hidden. */
export default function ReceiptUpload({
  initialRef = "",
  initialPhone = "",
  askIdentity = false,
}: {
  initialRef?: string;
  initialPhone?: string;
  askIdentity?: boolean;
}) {
  const [ref, setRef] = useState(initialRef);
  const [phone, setPhone] = useState(initialPhone);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Object URLs are not garbage collected on their own.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (f: File | null) => {
    setMsg(null);
    if (!f) return setFile(null);
    // Mirrors the server's checks; the server still enforces both.
    if (f.type !== "image/jpeg" && f.type !== "image/png") {
      setFile(null);
      return setMsg({ ok: false, text: "Hanya fail JPG atau PNG dibenarkan." });
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      return setMsg({ ok: false, text: "Saiz fail melebihi 5MB." });
    }
    setFile(f);
  };

  const send = async () => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const body = new FormData();
    body.set("ref", ref.trim());
    body.set("phone", phone.trim());
    body.set("file", file);
    try {
      const res = await fetch("/api/receipt", { method: "POST", body });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: json.error ?? "Muat naik gagal. Cuba lagi." });
      } else {
        setMsg({ ok: true, text: "Resit diterima. Kami sahkan dalam 24 jam dan WhatsApp anda." });
        setFile(null);
        if (input.current) input.current.value = "";
      }
    } catch {
      setMsg({ ok: false, text: "Tiada sambungan. Cuba lagi sebentar." });
    }
    setBusy(false);
  };

  const identified = ref.trim() !== "" && phone.trim() !== "";

  return (
    <div className={styles.receipt}>
      {askIdentity && (
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Booking reference</span>
            <input
              className={styles.input}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="cth: CS-2704-014"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Phone number used</span>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0123456789"
              inputMode="tel"
            />
          </label>
        </div>
      )}
      <label className={styles.drop}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Receipt preview" className={styles.dropPreview} />
        ) : (
          <span className={styles.dropHint}>
            <Icon name="upload" size={22} />
            Tekan untuk pilih tangkap skrin resit (JPG/PNG, max 5MB)
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className={styles.srOnly}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        className={styles.btnPrimary}
        onClick={send}
        disabled={!file || !identified || busy}
      >
        {busy ? "Uploading..." : "Upload Receipt"}
      </button>
      {msg && (
        <p role="status" className={msg.ok ? styles.noteOk : styles.noteErr}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
