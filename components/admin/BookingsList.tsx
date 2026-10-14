"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

export type BookingListRow = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  status: "pending" | "confirmed" | "deposit_due" | "weather_hold" | "cancelled";
  night_date: string;
  pax: number;
  price_per_pax: number;
  deposit_paid: boolean;
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

// "All" plus every real booking_status value. Bookings genuinely start as
// `pending` (the public form and "Assign booking" both default to it), so
// the tab that reaches them must always be there.
const TABS = ["all", "pending", "deposit_due", "confirmed", "weather_hold", "cancelled"] as const;

const PAGE_SIZES = [10, 20, 50, 0] as const; // 0 = all

/** Digits only, with Malaysia's 60 prefix, for a wa.me link. */
function waNumber(phone: string): string {
  const d = phone.replace(/[^0-9]/g, "");
  return d.startsWith("60") ? d : d.startsWith("0") ? `6${d}` : d;
}

/** The bookings table: status tabs with counts, search, boat filter, page
 *  size and paging. All client-side over the loaded rows — one operator's
 *  bookings run to hundreds, not tens of thousands. */
export default function BookingsList({ rows }: { rows: BookingListRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [query, setQuery] = useState("");
  const [boat, setBoat] = useState("all");
  const [size, setSize] = useState<number>(20);
  const [page, setPage] = useState(0);

  const boats = useMemo(
    () => Array.from(new Set(rows.map((r) => r.boats?.code).filter(Boolean) as string[])).sort(),
    [rows]
  );

  // Tab counts ignore the search and boat filter, like the reference admin:
  // they describe the whole book, not the current view.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (boat !== "all" && r.boats?.code !== boat) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.ref.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && r.phone.replace(/[^0-9]/g, "").includes(qDigits))
      );
    });
  }, [rows, tab, boat, query]);

  const pages = size === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages - 1);
  const shown = size === 0 ? filtered : filtered.slice(current * size, current * size + size);
  const from = filtered.length === 0 ? 0 : (size === 0 ? 0 : current * size) + 1;
  const to = size === 0 ? filtered.length : Math.min(filtered.length, current * size + size);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <div>
      <div className={styles.dtTabs} role="tablist" aria-label="Booking status">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${styles.dtTab} ${tab === t ? styles.dtTabOn : ""}`}
            onClick={() => reset(setTab)(t)}
          >
            {t === "all" ? "All" : STATUS_LABEL[t]} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      <div className={styles.dtCard}>
        <div className={styles.dtBar}>
          <label>
            Show{" "}
            <select
              className={styles.dtSelect}
              value={size}
              onChange={(e) => reset(setSize)(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "All" : n}
                </option>
              ))}
            </select>
          </label>
          <select
            className={styles.dtSelect}
            value={boat}
            onChange={(e) => reset(setBoat)(e.target.value)}
            aria-label="Boat"
          >
            <option value="all">All boats</option>
            {boats.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input
            className={styles.dtSearch}
            type="search"
            placeholder="Search name, phone or reference…"
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
          />
        </div>

        <div className={styles.dtScroll}>
          <table className={styles.dtTable}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Night</th>
                <th>Boat</th>
                <th className={styles.dtNum}>Pax</th>
                <th className={styles.dtNum}>Total</th>
                <th>Deposit</th>
                <th>Status</th>
                <th className={styles.dtNum}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td className={styles.dtStrong}>{b.ref}</td>
                  <td>
                    <span className={styles.dtStrong}>{b.full_name}</span>
                    <span className={styles.dtSub}>{b.phone}</span>
                  </td>
                  <td>{formatLongDate(b.night_date)}</td>
                  <td>{b.boats?.code ?? "—"}</td>
                  <td className={styles.dtNum}>{b.pax}</td>
                  <td className={styles.dtNum}>{formatRM(b.pax * b.price_per_pax)}</td>
                  <td>{b.deposit_paid ? "Paid" : "—"}</td>
                  <td>
                    <span className={`${styles.manifestStatus} ${STATUS_CLASS[b.status] ?? ""}`}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.dtActions}>
                      <Link href={`/admin/bookings/${b.id}`} className={`${styles.dtBtn} ${styles.dtBtnView}`}>
                        View
                      </Link>
                      <a
                        href={`https://wa.me/${waNumber(b.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.dtBtn} ${styles.dtBtnWa}`}
                      >
                        WhatsApp
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className={styles.dtEmpty}>No bookings match. Try another tab or clear the search.</div>
          )}
        </div>

        <div className={styles.dtFoot}>
          <span>
            Showing {from}–{to} of {filtered.length}
          </span>
          {pages > 1 && (
            <div className={styles.dtPager}>
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ‹
              </button>
              {Array.from({ length: pages }, (_, i) => i)
                .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - current) <= 1)
                .map((i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === current ? styles.dtPageOn : ""}
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              <button
                type="button"
                disabled={current === pages - 1}
                onClick={() => setPage(current + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
