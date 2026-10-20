"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/public/book/Icon";
import Kanban, { type KanbanColumn } from "./Kanban";
import BookingActions, { postAction } from "@/components/admin/bookingActions/BookingActions";
import type { MoveBoat } from "@/components/admin/bookingActions/MoveDialog";
import type { BookingListRow } from "@/components/admin/BookingsList";
import { allowedActions, jettyBalance, paymentSummary, refundOwed, type ActionKey } from "@/lib/booking/actions";
import { upfrontAmount } from "@/lib/booking/amounts";
import { addDaysISO, formatRM } from "@/lib/date";
import { formatLongDate } from "@/lib/season";
import styles from "./board.module.css";

export type BoardRow = BookingListRow & {
  created_at: string;
  deposit_paid_at: string | null;
  review_rating: number | null;
};

type ColKey = "new" | "accepted" | "paid" | "departing" | "done" | "weather";

const SOURCE_ICON: Record<string, { icon: string; label: string; tone?: string }> = {
  website: { icon: "search", label: "Booked on the website" },
  whatsapp: { icon: "whatsapp", label: "Booked on WhatsApp", tone: "wa" },
  phone: { icon: "broadcast", label: "Booked by phone" },
  walk_in: { icon: "pin", label: "Walk-in" },
  other: { icon: "users", label: "Other source" },
};

const RANGES = [
  { key: "30", label: "Next 30 nights" },
  { key: "90", label: "Next 90 nights" },
  { key: "all", label: "All upcoming" },
];

/** Which column a booking sits in now. */
function columnOf(b: BoardRow, today: string): ColKey | null {
  if (b.status === "cancelled") return null;
  if (b.status === "weather_hold") return "weather";
  if (b.status === "pending") return "new";
  if (b.status === "deposit_due") return "accepted";
  if (b.night_date < today) return "done";
  if (b.night_date <= addDaysISO(today, 2)) return "departing";
  return "paid";
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);
}

/** Bookings as a flow: New → Accepted → Paid → Departing → Done, with a
 *  Weather hold lane. Dragging a card runs the matching booking action. */
export default function BookingBoard({ rows, boats, today }: { rows: BoardRow[]; boats: MoveBoat[]; today: string }) {
  const router = useRouter();
  const [range, setRange] = useState("30");
  const [boat, setBoat] = useState("");
  const [source, setSource] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<BoardRow | null>(null);
  const [splash, setSplash] = useState<string | null>(null);

  const until = range === "all" ? "9999-12-31" : addDaysISO(today, Number(range) - 1);
  const pastFrom = addDaysISO(today, -14);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return rows.filter((b) => {
      if (boat && b.boat_id !== boat) return false;
      if (source && (b.source ?? "website") !== source) return false;
      if (q && !`${b.full_name} ${b.ref}`.toLowerCase().includes(q) && !(qd.length >= 3 && b.phone.includes(qd))) return false;
      // In range: upcoming within the window; the last 14 days of past trips;
      // and anything still needing a hand (pending, deposit due, weather).
      const needsHand = ["pending", "deposit_due", "weather_hold"].includes(b.status);
      if (b.night_date >= today) return b.night_date <= until || needsHand;
      return b.night_date >= pastFrom || (b.status === "confirmed" && !b.trip_outcome);
    });
  }, [rows, boat, source, query, today, until, pastFrom]);

  const run = async (b: BoardRow, action: ActionKey, ok: string) => {
    setToast(null);
    const r = await postAction(b.id, { action });
    if (!r.ok) return setToast({ ok: false, text: `${b.ref}: ${r.error}` });
    setToast({ ok: true, text: `${b.ref}: ${ok}${r.emailed ? " Email sent." : ""}` });
    if (action === "complete") setSplash(b.id);
    router.refresh();
  };

  const by = (k: ColKey) =>
    shown
      .filter((b) => columnOf(b, today) === k)
      .sort((a, z) => (k === "done" ? z.night_date.localeCompare(a.night_date) : a.night_date.localeCompare(z.night_date)));
  const sum = (list: BoardRow[]) => formatRM(list.reduce((s, b) => s + Number(b.total_amount), 0));
  const allows = (k: ActionKey) => (b: BoardRow) => allowedActions(b, today).includes(k);

  const cols: Record<ColKey, BoardRow[]> = {
    new: by("new"),
    accepted: by("accepted"),
    paid: by("paid"),
    departing: by("departing"),
    done: by("done"),
    weather: by("weather"),
  };

  const columns: KanbanColumn<BoardRow>[] = [
    { key: "new", label: "New", icon: "inbox", tone: "grey", items: cols.new, sub: sum(cols.new), empty: "No new bookings" },
    {
      key: "accepted",
      label: "Accepted",
      icon: "check",
      tone: "gold",
      items: cols.accepted,
      sub: `${sum(cols.accepted)} · waiting for deposit`,
      accepts: allows("accept"),
      onDrop: (b) => run(b, "accept", "accepted, the night is held."),
    },
    {
      key: "paid",
      label: "Paid",
      icon: "card",
      tone: "green",
      items: cols.paid,
      sub: sum(cols.paid),
      accepts: allows("mark_deposit"),
      onDrop: (b) => setConfirmPaid(b),
    },
    {
      key: "departing",
      label: "Departing",
      icon: "anchor",
      tone: "lamp",
      items: cols.departing,
      sub: "Tonight to 2 days",
      empty: "No trips in the next 2 days",
    },
    {
      key: "done",
      label: "Done",
      icon: "fish",
      tone: "purple",
      items: cols.done,
      sub: `${cols.done.filter((b) => !b.trip_outcome).length} to close`,
      accepts: allows("complete"),
      onDrop: (b) => run(b, "complete", "trip completed. Terima kasih!"),
    },
    {
      key: "weather",
      label: "Weather hold",
      icon: "cloud",
      tone: "teal",
      items: cols.weather,
      sub: "Pick a new date",
      accepts: allows("weather_hold"),
      onDrop: (b) => run(b, "weather_hold", "on weather hold."),
      empty: "Calm seas",
    },
  ];

  // ---- report strip, for what the filters show
  const live = shown.filter((b) => b.status !== "cancelled");
  const held = live.filter((b) => b.deposit_paid).reduce((s, b) => s + upfrontAmount(b), 0);
  const toCollect = live.filter((b) => b.deposit_paid).reduce((s, b) => s + jettyBalance(b), 0);
  const reached = live.filter((b) => b.deposit_paid).length;
  const conversion = live.length ? Math.round((reached / live.length) * 100) : 0;
  const payDays = live
    .filter((b) => b.deposit_paid && b.deposit_paid_at)
    .map((b) => Math.max(0, daysBetween(b.created_at, b.deposit_paid_at!)));
  const avgPay = payDays.length ? (payDays.reduce((s, n) => s + n, 0) / payDays.length).toFixed(1) : "—";
  const cancelled = shown.filter((b) => b.status === "cancelled");
  const refunds = cancelled.reduce((s, b) => s + refundOwed(b), 0);

  return (
    <div>
      <div className={styles.strip}>
        <div className={styles.stat}>
          <Icon name="coins" size={24} />
          <span>
            <b>{formatRM(held)}</b>
            <span>deposits held</span>
          </span>
        </div>
        <div className={styles.stat}>
          <Icon name="anchor" size={24} />
          <span>
            <b>{formatRM(toCollect)}</b>
            <span>to collect at the jetty</span>
          </span>
        </div>
        <div className={styles.stat}>
          <Icon name="sparkle" size={24} />
          <span>
            <b>{conversion}%</b>
            <span>booked → paid</span>
          </span>
        </div>
        <div className={styles.stat}>
          <Icon name="clock" size={24} />
          <span>
            <b>{avgPay} days</b>
            <span>booking to payment</span>
          </span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <select aria-label="Nights shown" value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select aria-label="Boat" value={boat} onChange={(e) => setBoat(e.target.value)}>
          <option value="">All boats</option>
          {boats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code}
            </option>
          ))}
        </select>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {Object.entries(SOURCE_ICON).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label.replace("Booked ", "").replace(/^on the |^on |^by /, "")}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search name, phone or ref…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {toast && <p className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>{toast.text}</p>}

      <Kanban
        columns={columns}
        itemKey={(b) => b.id}
        renderCard={(b) => (
          <BookingCard
            b={b}
            today={today}
            boats={boats}
            splash={splash === b.id}
          />
        )}
      />

      <div className={styles.footer}>
        <Icon name="undo" size={16} />
        {cancelled.length} cancelled in this view
        {refunds > 0 && <b style={{ color: "var(--danger-text)" }}>· {formatRM(refunds)} refunds still to pay</b>}
        <Link href="/admin/bookings">See them in the list (Cancelled tab)</Link>
        <span>· Drag a card to move it, or use its buttons.</span>
      </div>

      {confirmPaid && (
        <div role="dialog" aria-modal="true" style={confirmStyle.overlay} onMouseDown={(e) => e.target === e.currentTarget && setConfirmPaid(null)}>
          <div style={confirmStyle.box}>
            <b>Mark {confirmPaid.ref} paid?</b>
            <span style={{ fontSize: 13.5, color: "var(--text-muted-2)" }}>
              {formatRM(upfrontAmount(confirmPaid))} from {confirmPaid.full_name}. This confirms the booking and emails the customer.
            </span>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={confirmStyle.ghost} onClick={() => setConfirmPaid(null)}>
                Not yet
              </button>
              <button
                type="button"
                style={confirmStyle.primary}
                onClick={() => {
                  const b = confirmPaid;
                  setConfirmPaid(null);
                  run(b, "mark_deposit", "deposit marked paid, booking confirmed.");
                }}
              >
                Mark paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const confirmStyle = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 70,
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "rgba(27,20,54,0.45)",
  },
  box: {
    width: "min(420px, 100%)",
    display: "grid",
    gap: 12,
    padding: 20,
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 30px 70px rgba(27,20,54,0.35)",
  },
  ghost: {
    minHeight: 40,
    padding: "8px 16px",
    borderRadius: 12,
    border: "1px solid var(--border-strong)",
    background: "#fff",
    color: "var(--purple)",
    font: "inherit",
    fontWeight: 700,
    cursor: "pointer",
  },
  primary: {
    minHeight: 40,
    padding: "8px 16px",
    borderRadius: 12,
    border: 0,
    background: "var(--gold)",
    color: "#1f1a2e",
    font: "inherit",
    fontWeight: 700,
    cursor: "pointer",
  },
};

function BookingCard({ b, today, boats, splash }: { b: BoardRow; today: string; boats: MoveBoat[]; splash: boolean }) {
  const days = daysBetween(today, b.night_date);
  const pay = paymentSummary(b, formatRM);
  const src = SOURCE_ICON[b.source ?? "website"] ?? SOURCE_ICON.website;
  const events: Array<{ icon: string; label: string; tone?: string }> = [src];
  if (b.receipt_url && !b.deposit_paid) events.push({ icon: "receipt", label: "Receipt uploaded, to check", tone: "gold" });
  if (b.deposit_paid) events.push({ icon: "card", label: "Deposit paid", tone: "green" });
  if (b.balance_paid) events.push({ icon: "coins", label: "Balance collected", tone: "green" });
  if (b.status === "weather_hold") events.push({ icon: "cloud", label: "Weather hold" });
  if (b.trip_outcome === "completed") events.push({ icon: "fish", label: "Trip completed", tone: "green" });
  if (b.trip_outcome === "no_show") events.push({ icon: "undo", label: "No-show", tone: "red" });
  if (refundOwed(b) > 0) events.push({ icon: "undo", label: "Refund due", tone: "red" });
  if (b.review_rating) events.push({ icon: "star", label: `Reviewed ${b.review_rating}★`, tone: "gold" });

  return (
    <article className={`${styles.card} ${splash ? styles.splash : ""}`}>
      <div className={styles.cardTop}>
        <span>
          <Link href={`/admin/bookings/${b.id}`} className={styles.cardName} data-pii="name" draggable={false}>
            {b.full_name}
          </Link>
          <span className={styles.cardRef}> · {b.ref}</span>
        </span>
        <span
          className={`${styles.countdown} ${days < 0 ? styles.countdownPast : days <= 2 ? styles.countdownSoon : ""}`}
          title={formatLongDate(b.night_date)}
        >
          {days === 0 ? "Tonight" : days === 1 ? "Tomorrow" : days > 0 ? `${days} days` : `${-days}d ago`}
        </span>
      </div>
      <span className={styles.meta}>
        {b.boats?.code ?? "?"} · {formatLongDate(b.night_date)} · {b.pax} pax
      </span>
      <span className={`${styles.chip} ${styles[`chip_${pay.tone}`]}`}>{pay.text}</span>
      <div className={styles.events}>
        {events.map((e, i) => (
          <span key={i} className={`${styles.event} ${e.tone ? styles[`event_${e.tone}`] : ""}`} title={e.label} aria-label={e.label}>
            <Icon name={e.icon} size={15} />
          </span>
        ))}
      </div>
      <BookingActions today={today} boats={boats} booking={{ ...b, boat_code: b.boats?.code ?? "?" }} />
    </article>
  );
}
