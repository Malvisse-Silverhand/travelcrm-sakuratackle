"use client";

import { useMemo } from "react";
import { DOW_LABELS, HOLIDAYS, MONTHS, isoDate, monthLabel } from "@/lib/season";
import type { Availability } from "./BookingExperience";
import styles from "@/app/booking.module.css";

export const STATUS_WORD: Record<string, string> = {
  open: "Available",
  selling_fast: "Selling Fast",
  full: "Full",
  blocked: "Tidak dibuka",
};

type Props = {
  monthIdx: number;
  firstMonthIdx: number;
  onMonth: (idx: number) => void;
  byDate: Map<string, Availability>;
  selected: string | null;
  loading: boolean;
  onPick: (iso: string) => void;
};

/** Month navigation and the night grid — step 1 of the booking flow. */
export default function BookingCalendar({
  monthIdx,
  firstMonthIdx,
  onMonth,
  byDate,
  selected,
  loading,
  onPick,
}: Props) {
  const month = MONTHS[monthIdx];
  const holidayDays = useMemo(() => (HOLIDAYS[monthIdx] ?? []).map((h) => h.d), [monthIdx]);

  const cells = useMemo(() => {
    // Monday-first lead padding, matching the design's `(first + 6) % 7`.
    const first = new Date(month.year, month.m, 1).getDay();
    const lead = (first + 6) % 7;
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < lead; i++) out.push({ key: `pad-${i}`, day: null, iso: null });
    for (let d = 1; d <= month.days; d++) {
      out.push({ key: `d-${d}`, day: d, iso: isoDate(monthIdx, d) });
    }
    return out;
  }, [month, monthIdx]);

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
          onClick={() => onMonth(Math.max(firstMonthIdx, monthIdx - 1))}
          disabled={monthIdx === firstMonthIdx}
          aria-label="Bulan sebelum"
        >
          &#8592;
        </button>
        <span className={styles.monthLabel} aria-live="polite">
          {monthLabel(monthIdx)}
        </span>
        <button
          type="button"
          className={styles.monthBtn}
          onClick={() => onMonth(Math.min(MONTHS.length - 1, monthIdx + 1))}
          disabled={monthIdx === MONTHS.length - 1}
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
              aria-label={`${c.day} ${monthLabel(monthIdx)}${
                row ? ` — ${STATUS_WORD[row.status]}` : ""
              }`}
            >
              {c.day}
              {holidayDays.includes(c.day) && (
                <i
                  className={`${styles.holidayDot} ${
                    iso === selected ? styles.holidayDotSelected : ""
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
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
