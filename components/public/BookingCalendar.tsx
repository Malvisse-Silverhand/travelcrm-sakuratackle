"use client";

import { useMemo } from "react";
import {
  DOW_LABELS,
  holidaysIn,
  monthISO,
  monthLabel,
  type SeasonMonth,
} from "@/lib/season";
import type { Availability } from "./BookingExperience";
import styles from "@/app/booking.module.css";

export const STATUS_WORD: Record<string, string> = {
  open: "Available",
  selling_fast: "Selling Fast",
  full: "Full",
  blocked: "Tidak dibuka",
};

type Props = {
  months: SeasonMonth[];
  monthIdx: number;
  onMonth: (idx: number) => void;
  byDate: Map<string, Availability>;
  selected: string | null;
  loading: boolean;
  onPick: (iso: string) => void;
};

/** Month navigation and the night grid — step 1 of the booking flow. */
export default function BookingCalendar({
  months,
  monthIdx,
  onMonth,
  byDate,
  selected,
  loading,
  onPick,
}: Props) {
  const month = months[monthIdx];
  const holidayDays = useMemo(() => holidaysIn(month).map((h) => h.d), [month]);

  const cells = useMemo(() => {
    // Monday-first lead padding, matching the design's `(first + 6) % 7`.
    const first = new Date(month.year, month.m, 1).getDay();
    const lead = (first + 6) % 7;
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < lead; i++) out.push({ key: `pad-${i}`, day: null, iso: null });
    for (let d = 1; d <= month.days; d++) {
      out.push({ key: `d-${d}`, day: d, iso: monthISO(month, d) });
    }
    return out;
  }, [month]);

  const cellClass = (iso: string) => {
    if (loading) return `${styles.cell} ${styles.cellLoading}`;
    if (iso === selected) return `${styles.cell} ${styles.cellSelected}`;
    const row = byDate.get(iso);
    if (!row) return `${styles.cell} ${styles.cellLoading}`;
    if (row.status === "open") return `${styles.cell} ${styles.cellOpen}`;
    if (row.status === "selling_fast") return `${styles.cell} ${styles.cellHold}`;
    return `${styles.cell} ${styles.cellFull}`;
  };

  return (
    <>
      <div className={styles.monthNav}>
        <button
          type="button"
          className={styles.monthBtn}
          onClick={() => onMonth(Math.max(0, monthIdx - 1))}
          disabled={monthIdx === 0}
          aria-label="Bulan sebelum"
        >
          &#8592;
        </button>
        <span className={styles.monthLabel} aria-live="polite">
          {monthLabel(month)}
        </span>
        <button
          type="button"
          className={styles.monthBtn}
          onClick={() => onMonth(Math.min(months.length - 1, monthIdx + 1))}
          disabled={monthIdx === months.length - 1}
          aria-label="Bulan seterusnya"
        >
          &#8594;
        </button>
      </div>

      <div className={styles.grid}>
        {DOW_LABELS.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
        {cells.map((c) => {
          if (!c.day || !c.iso) {
            return <span key={c.key} className={`${styles.cell} ${styles.cellPad}`} />;
          }
          const iso = c.iso;
          const row = byDate.get(iso);
          const isSelected = iso === selected && !loading;
          const disabled =
            loading || !row || row.status === "full" || row.status === "blocked";
          return (
            <button
              key={c.key}
              type="button"
              className={cellClass(iso)}
              disabled={disabled}
              onClick={() => onPick(iso)}
              aria-pressed={iso === selected}
              aria-label={`${c.day} ${monthLabel(month)}${
                row ? ` — ${STATUS_WORD[row.status]}` : ""
              }`}
            >
              {isSelected && <BoatBadge />}
              <span className={styles.cellDay}>{c.day}</span>
              {holidayDays.includes(c.day) && (
                <i
                  className={`${styles.holidayDot} ${isSelected ? styles.holidayDotSelected : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The little boat that sits on the chosen night. */
function BoatBadge() {
  return (
    <svg className={styles.cellBoat} viewBox="0 0 28 20" aria-hidden="true">
      <path d="M2 11h24l-3.6 6.2a2 2 0 0 1-1.7 1H7.3a2 2 0 0 1-1.7-1Z" fill="#2e1d6b" />
      <path d="M2 11h24l-.7 1.3H2.7Z" fill="#ffb800" />
      <rect x="9" y="4.5" width="9" height="6.5" rx="1.6" fill="#fff" />
      <rect x="10.8" y="6.3" width="2.2" height="2.2" rx=".5" fill="#2e1d6b" />
      <rect x="14.2" y="6.3" width="2.2" height="2.2" rx=".5" fill="#2e1d6b" />
      <path d="M13.5 4.5V1.6" stroke="#2e1d6b" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="13.5" cy="1.6" r="1.4" fill="#5dff9c" />
    </svg>
  );
}

export function CalendarLegend() {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <i className={styles.legendDot} style={{ background: "var(--success)" }} />
        Available
      </span>
      <span className={styles.legendItem}>
        <i className={styles.legendDot} style={{ background: "var(--gold)" }} />
        Selling Fast
      </span>
      <span className={styles.legendItem}>
        <i className={styles.legendDot} style={{ background: "var(--danger-bg)" }} />
        Full
      </span>
    </div>
  );
}
