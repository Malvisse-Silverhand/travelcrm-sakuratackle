"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import ReceiptUpload from "./ReceiptUpload";
import Icon from "./Icon";
import { formatLongDate } from "@/lib/season";
import { BANK } from "@/lib/content/site";
import { rm } from "@/lib/content/booking";
import { balanceDue, bookingTotal, upfrontAmount } from "@/lib/booking/amounts";
import type { CancelQuote } from "@/lib/booking/cancellation";
import { waLink } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/site-url";
import styles from "./book.module.css";

type View = {
  booking: {
    ref: string;
    full_name: string;
    night_date: string;
    pax: number;
    status: string;
    total_amount: number;
    deposit_amount: number;
    deposit_paid: boolean;
    pay_plan: string | null;
    receipt_url: string | null;
    boats: { code: string; display_name: string | null; capacity: number; jetties: { name: string; subtitle: string } | null } | null;
  };
  names: string[];
  requests: Array<{ kind: string; new_date: string | null; status: string; refund_amount: number | null; created_at: string }>;
  review: { rating: number; comment: string | null; status: string } | null;
  today: string;
  cancel: CancelQuote | null;
  canChange: boolean;
  canReview: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Awaiting payment", cls: "pillHeld" },
  deposit_due: { label: "Deposit due", cls: "pillHeld" },
  confirmed: { label: "Confirmed", cls: "pillOk" },
  weather_hold: { label: "Weather hold", cls: "pillHeld" },
  cancelled: { label: "Cancelled", cls: "pillOff" },
};

async function call<T>(payload: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/my-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? "Cuba lagi sebentar." };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Tiada sambungan. Cuba lagi sebentar." };
  }
}

/** Manage My Booking: the customer's own booking, by reference + phone. */
export default function ManageBooking({ initialRef, waNumber }: { initialRef: string; waNumber: string }) {
  const [ref, setRef] = useState(initialRef);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const r = await call<View>({ action: "view", ref, phone });
    setBusy(false);
    if (!r.ok) {
      setView(null);
      setErr(r.error);
      return;
    }
    setView(r.data);
  }, [ref, phone]);

  if (!view) {
    return (
      <section className={styles.panel}>
        <h1 className={styles.panelTitle}>Manage My Booking</h1>
        <p className={styles.muted}>
          Masukkan nombor rujukan dan nombor telefon tempahan untuk lihat status, bayar, tambah nama
          ahli group, tukar tarikh atau batalkan.
        </p>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Booking reference</span>
            <input className={styles.input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="cth: CS-2703-014" autoCapitalize="characters" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Phone number used</span>
            <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0123456789" inputMode="tel" />
          </label>
        </div>
        {err && <p role="alert" className={styles.noteErr}>{err}</p>}
        <div className={styles.actionsRow}>
          <button type="button" className={styles.btnPrimary} disabled={busy || !ref.trim() || !phone.trim()} onClick={load}>
            {busy ? "Checking..." : "Find My Booking"}
          </button>
        </div>
      </section>
    );
  }

  return <Booking view={view} phone={phone} reload={load} waNumber={waNumber} />;
}

function Booking({ view, phone, reload, waNumber }: { view: View; phone: string; reload: () => Promise<void>; waNumber: string }) {
  const b = view.booking;
  const boat = b.boats?.display_name ?? b.boats?.code ?? "Bot";
  const jetty = b.boats?.jetties?.subtitle || b.boats?.jetties?.name || "Jeti Marang, Terengganu";
  const st = STATUS[b.status] ?? { label: b.status, cls: "pillHeld" };
  const upfront = upfrontAmount(b);
  const waHref = waLink(
    waNumber,
    `Hai Sakura Tackle! Saya ${b.full_name}, tempahan ${b.ref} (${boat}, ${formatLongDate(b.night_date)}).\n\nSoalan saya: ___\n\n${SITE_URL}/my-booking?ref=${b.ref}`
  );
  const openRequests = view.requests.filter((r) => r.status === "open");

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.manageHead}>
          <div>
            <span className={styles.eyebrow}>Booking {b.ref}</span>
            <h1 className={styles.panelTitle}>{boat}</h1>
            <span className={styles.boatLoc}>
              <Icon name="pin" size={15} />
              {jetty}
            </span>
          </div>
          <span className={`${styles.pill} ${styles[st.cls]}`}>{st.label}</span>
        </div>
        <div className={styles.refBox}>
          <div>
            <div className={styles.refLabel}>Date</div>
            <div className={styles.refAmt}>{formatLongDate(b.night_date)}</div>
          </div>
          <div>
            <div className={styles.refLabel}>Group</div>
            <div className={styles.refAmt}>{b.pax} pax</div>
          </div>
          <div>
            <div className={styles.refLabel}>Total</div>
            <div className={styles.refAmt}>{rm(bookingTotal(b))}</div>
          </div>
          <div>
            <div className={styles.refLabel}>Balance at jetty</div>
            <div className={styles.refAmt}>{rm(balanceDue(b))}</div>
          </div>
        </div>
        {openRequests.map((r, i) => (
          <p key={i} className={styles.noteWarn}>
            {r.kind === "reschedule"
              ? `Permintaan tukar ke ${formatLongDate(r.new_date!)} sedang diproses. Kami WhatsApp anda.`
              : `Bayaran balik ${rm(Number(r.refund_amount ?? 0))} sedang diproses.`}
          </p>
        ))}
        <div className={styles.actionsRow}>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={styles.btnWa}>
            <Icon name="whatsapp" size={18} />
            WhatsApp Us
          </a>
          <Link href="/polisi" className={styles.btnGhost}>
            Booking Terms
          </Link>
        </div>
      </section>

      {view.canChange && !b.deposit_paid && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Payment</h2>
          {b.receipt_url ? (
            <p className={styles.noteOk}>Resit anda dah diterima. Kami sahkan dalam 24 jam dan WhatsApp anda.</p>
          ) : (
            <p className={styles.muted}>
              Pindahkan {rm(upfront)} dan guna {b.ref} sebagai rujukan, kemudian muat naik resit.
            </p>
          )}
          <div className={styles.bankCard}>
            <BankRow label="Bank" value={BANK.bank} />
            <BankRow label="Account name" value={BANK.accountName} />
            <BankRow label="Account no." value={BANK.accountNumber} />
            <BankRow label="Amount" value={rm(upfront)} />
          </div>
          <ReceiptUpload initialRef={b.ref} initialPhone={phone} />
        </section>
      )}

      {view.canChange && <GuestNames refId={b.ref} phone={phone} pax={b.pax} initial={view.names} />}

      {view.canChange && !openRequests.some((r) => r.kind === "reschedule") && (
        <ChangeDate refId={b.ref} phone={phone} today={view.today} current={b.night_date} onDone={reload} />
      )}

      {view.canChange && view.cancel && <Cancel refId={b.ref} phone={phone} quote={view.cancel} onDone={reload} />}

      {view.canReview && <Review refId={b.ref} phone={phone} firstName={b.full_name.split(" ")[0]} onDone={reload} />}
      {view.review && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Your Review</h2>
          <p className={styles.stars} aria-label={`${view.review.rating} of 5`}>
            {"★".repeat(view.review.rating)}
            <span>{"★".repeat(5 - view.review.rating)}</span>
          </p>
          {view.review.comment && <p className={styles.muted}>“{view.review.comment}”</p>}
          <p className={styles.muted}>Terima kasih atas ulasan anda!</p>
        </section>
      )}
    </>
  );
}

function GuestNames({ refId, phone, pax, initial }: { refId: string; phone: string; pax: number; initial: string[] }) {
  const [names, setNames] = useState<string[]>(() => Array.from({ length: pax }, (_, i) => initial[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pax-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: refId, phone, names }),
      });
      const json = (await res.json()) as { error?: string; saved?: number };
      setMsg(res.ok ? { ok: true, text: `${json.saved} nama disimpan.` } : { ok: false, text: json.error ?? "Tidak dapat menyimpan." });
    } catch {
      setMsg({ ok: false, text: "Tiada sambungan. Cuba lagi." });
    }
    setBusy(false);
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Guest Names</h2>
      <p className={styles.muted}>Senarai nama untuk rekod keselamatan di bot. Boleh dikemas kini bila-bila masa sebelum trip.</p>
      <div className={styles.guestGrid}>
        {names.map((n, i) => (
          <input
            key={i}
            className={styles.input}
            value={n}
            onChange={(e) => {
              const next = [...names];
              next[i] = e.target.value;
              setNames(next);
              setMsg(null);
            }}
            placeholder={i === 0 ? "Ketua group" : `Ahli ${i + 1}`}
            aria-label={`Guest ${i + 1}`}
          />
        ))}
      </div>
      {msg && <p className={msg.ok ? styles.noteOk : styles.noteErr}>{msg.text}</p>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.btnPrimary} disabled={busy || names.every((n) => !n.trim())} onClick={save}>
          {busy ? "Saving..." : "Save Names"}
        </button>
      </div>
    </section>
  );
}

function ChangeDate({ refId, phone, today, current, onDone }: { refId: string; phone: string; today: string; current: string; onDone: () => Promise<void> }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await call({ action: "reschedule", ref: refId, phone, newDate: date, note });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await onDone();
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Change Date</h2>
      <p className={styles.muted}>
        Pilih tarikh baru untuk bot yang sama. Kami semak dan sahkan melalui WhatsApp. Lihat{" "}
        <Link href="/polisi#batal">terma tukar tarikh</Link>.
      </p>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>New date</span>
          <input className={styles.input} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Note (optional)</span>
          <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sebab atau permintaan" />
        </label>
      </div>
      {err && <p role="alert" className={styles.noteErr}>{err}</p>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.btnGhost} disabled={busy || !date || date === current} onClick={send}>
          {busy ? "Sending..." : "Request Date Change"}
        </button>
      </div>
    </section>
  );
}

function Cancel({ refId, phone, quote, onDone }: { refId: string; phone: string; quote: CancelQuote; onDone: () => Promise<void> }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    const r = await call({ action: "cancel", ref: refId, phone });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await onDone();
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Cancel Booking</h2>
      <p className={quote.kept > 0 ? styles.noteWarn : styles.muted}>{quote.summary}</p>
      {quote.suggestMove && (
        <p className={styles.muted}>Tak dapat pergi pada tarikh ini? Cuba Change Date di atas dulu.</p>
      )}
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
        Saya faham dan nak batalkan tempahan ini.
      </label>
      {err && <p role="alert" className={styles.noteErr}>{err}</p>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.btnDanger} disabled={!sure || busy} onClick={go}>
          {busy ? "Cancelling..." : quote.refund > 0 ? `Cancel and refund ${rm(quote.refund)}` : "Cancel Booking"}
        </button>
      </div>
    </section>
  );
}

function Review({ refId, phone, firstName, onDone }: { refId: string; phone: string; firstName: string; onDone: () => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState(firstName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await call({ action: "review", ref: refId, phone, rating, comment, name });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await onDone();
  };

  return (
    <section id="review" className={styles.panel}>
      <h2 className={styles.panelTitle}>Rate Your Trip</h2>
      <p className={styles.muted}>Macam mana trip candat anda? Ulasan anda bantu group lain pilih bot.</p>
      <div className={styles.starPick} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={n <= rating ? styles.starOn : styles.starOff}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name shown</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Your review (optional)</span>
        <textarea className={styles.input} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Hasil tangkapan, kapten, bot, makanan..." />
      </label>
      {err && <p role="alert" className={styles.noteErr}>{err}</p>}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.btnPrimary} disabled={busy || rating === 0} onClick={send}>
          {busy ? "Sending..." : "Submit Review"}
        </button>
      </div>
    </section>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={styles.bankLabel}>{label}</span>
      <b className={styles.bankValue}>{value}</b>
    </div>
  );
}
