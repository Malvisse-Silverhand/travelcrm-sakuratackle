"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

export type BookingListRow = {
  id: string;
  ref: string;
  full_name: string;
  status: "pending" | "confirmed" | "deposit_due" | "weather_hold" | "cancelled";
  night_date: string;
  pax: number;
  price_per_pax: number;
  boats: { code: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  deposit_due: "Deposit due",
  weather_hold: "Weather hold",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending: styles.statusPending,
  confirmed: styles.statusConfirmed,
  deposit_due: styles.statusDepositDue,
  weather_hold: styles.statusWeatherHold,
  cancelled: styles.statusCancelled,
};

// "All" plus every real booking_status value. The design mockup's own fake
// data only ever used Confirmed/Deposit due/Weather hold, but this app's
// bookings genuinely start as `pending` (every create_public_booking call —
// public form or operator "Assign booking" — defaults to it), so a filter
// that couldn't reach them would hide every new lead by default.
const FILTERS: Array<{ key: string; label: string }> = [
  { key: "All", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "deposit_due", label: "Deposit due" },
  { key: "weather_hold", label: "Weather hold" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsList({ rows }: { rows: BookingListRow[] }) {
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(
    () => (filter === "All" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );

  return (
    <div>
      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.filterChip} ${filter === f.key ? styles.filterChipActive : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className={styles.filterCount}>
        {filtered.length} of {rows.length} shown
      </p>

      {filtered.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyCardTitle}>Tiada tempahan untuk penapis ini</p>
          <p className={styles.emptyCardBody}>Cuba penapis lain, atau pilih &quot;All&quot;.</p>
        </div>
      ) : (
        <div className={styles.bookingsGrid}>
          {filtered.map((b) => {
            const amount = b.pax * b.price_per_pax;
            return (
              <Link key={b.id} href={`/admin/bookings/${b.id}`} className={styles.bookingCard}>
                <div className={styles.bookingCardHead}>
                  <span className={styles.bookingCardName}>{b.full_name}</span>
                  <span className={`${styles.manifestStatus} ${STATUS_CLASS[b.status] ?? ""}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <div className={styles.bookingCardMeta}>
                  <span>{b.ref}</span>
                  <i className={styles.metaDot} />
                  <span>{b.boats?.code ?? "?"}</span>
                  <i className={styles.metaDot} />
                  <span>{formatLongDate(b.night_date)}</span>
                </div>
                <div className={styles.bookingCardFoot}>
                  <span className={styles.bookingCardPax}>{b.pax} pax</span>
                  <span
                    className={styles.bookingCardAmount}
                    style={{ color: b.status === "deposit_due" ? "var(--warn-text-2)" : "var(--ink)" }}
                  >
                    {formatRM(amount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
