"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { waLink, waOptIn } from "@/lib/whatsapp";
import styles from "./whatsappOptIn.module.css";

/** Every "WhatsApp Kami" link marked `data-wa-optin` opens this short form
 *  first: name and phone (needed), trip date and group size (optional).
 *  On "Teruskan ke WhatsApp" the details are saved as a lead and WhatsApp
 *  opens with them already typed into the message.
 *
 *  The links stay plain WhatsApp links underneath, so they still work before
 *  this script loads or if it fails. */
export default function WhatsAppOptIn() {
  const pathname = usePathname();
  const [open, setOpen] = useState<{ number: string } | null>(null);
  const [f, setF] = useState({ name: "", phone: "", date: "", pax: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Catch clicks on any marked link, anywhere on the page.
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element).closest?.("a[data-wa-optin]") as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      let number = "";
      try {
        number = new URL(a.href).searchParams.get("phone") ?? "";
      } catch {}
      opener.current = a;
      // The visitor's details from last time, remembered on this device.
      try {
        const saved = JSON.parse(localStorage.getItem("st-wa-optin") ?? "{}");
        setF((x) => ({ ...x, name: x.name || saved.name || "", phone: x.phone || saved.phone || "" }));
      } catch {}
      setError(null);
      setOpen({ number });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };

  // While open: focus the first field, Escape closes.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nameRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      opener.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

  const submit = () => {
    if (!open) return;
    const name = f.name.trim();
    const digits = f.phone.replace(/\D/g, "");
    if (name.length < 2) return setError("Sila isi nama anda.");
    if (digits.length < 9 || digits.length > 13) return setError("Sila isi no. telefon yang betul, cth 0123456789.");
    const pax = Number(f.pax) || null;
    const pretty = f.date
      ? new Date(`${f.date}T00:00:00Z`).toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      : null;

    const href = waLink(open.number || null, waOptIn({ name, phone: f.phone.trim(), date: pretty, pax }, pathname));

    // Save the lead without holding up WhatsApp (keepalive survives the
    // page losing focus).
    fetch("/api/leads/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: f.phone, date: f.date, pax, page: pathname, website: f.website }),
      keepalive: true,
    }).catch(() => null);
    try {
      localStorage.setItem("st-wa-optin", JSON.stringify({ name, phone: f.phone.trim() }));
    } catch {}

    // Opened straight from the click, so pop-up blockers allow it; some
    // in-app browsers still refuse, and then this tab goes to WhatsApp.
    const win = window.open(href, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = href;
    setOpen(null);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-optin-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className={styles.x} aria-label="Tutup" onClick={close}>
          ×
        </button>
        <span className={styles.badge}>
          <WhatsAppGlyph /> WhatsApp Kami
        </span>
        <h2 id="wa-optin-title" className={styles.title}>
          Sikit info dulu, nanti kami terus bantu
        </h2>
        <p className={styles.lead}>Isi nama dan nombor anda. Tarikh dan saiz group boleh tinggal kosong kalau belum pasti.</p>

        <div className={styles.grid}>
          <label className={styles.field} htmlFor="wa-name">
            <span>Nama *</span>
            <input
              ref={nameRef}
              id="wa-name"
              autoComplete="name"
              maxLength={120}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="Nama penuh"
            />
          </label>
          <label className={styles.field} htmlFor="wa-phone">
            <span>No. telefon *</span>
            <input
              id="wa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="0123456789"
            />
          </label>
          <label className={styles.field} htmlFor="wa-date">
            <span>Tarikh trip (pilihan)</span>
            <input id="wa-date" type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
          <label className={styles.field} htmlFor="wa-pax">
            <span>Saiz group (pilihan)</span>
            <input
              id="wa-pax"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={f.pax}
              onChange={(e) => setF({ ...f, pax: e.target.value })}
              placeholder="cth 8"
            />
          </label>
        </div>
        <input
          className={styles.honey}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={f.website}
          onChange={(e) => setF({ ...f, website: e.target.value })}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.go}>
          <WhatsAppGlyph /> Teruskan ke WhatsApp
        </button>
        <p className={styles.fine}>
          Dengan meneruskan, anda setuju Sakura Tackle menyimpan maklumat ini untuk menghubungi anda tentang trip.{" "}
          <a href="/polisi" target="_blank" rel="noopener noreferrer">
            Polisi privasi
          </a>
        </p>
      </form>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path
        d="M9.2 8.2c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c-.1.1-.1.3 0 .5.6 1 1.4 1.8 2.4 2.4.2.1.4.1.5 0l.6-.5c.2-.2.4-.2.7-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.6.4-1.4.6-2.2.4-2.6-.7-4.6-2.7-5.3-5.3-.2-.8 0-1.6.4-2.3Z"
        fill="currentColor"
      />
    </svg>
  );
}
