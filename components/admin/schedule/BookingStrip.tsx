"use client";

import Link from "next/link";
import { useState } from "react";
import { CELL_LABEL, type CellStatus } from "@/lib/booking/schedule";
import { WEEKDAYS_EN, dayLabel, dayOfMonth, weekdayIdx } from "./calendarDates";
import styles from "./schedule.module.css";

export type StripBoat = { id: string; code: string; capacity: number; jettyName: string };
export type StripCell = { status: CellStatus; pax: number; note: string };

type Props = {
  boats: StripBoat[];
  /** 30 nights from today. */
  nights: string[];
  today: string;
  /** cells[boatId][i] lines up with nights[i]. */
  cells: Record<string, StripCell[]>;
};

// Mirrors STATUS_CLASS in ScheduleViews, which is a server module.
const STATUS_CLASS: Record<CellStatus, string> = {
  open: styles.stOpen,
  pending: styles.stPending,
  deposit_due: styles.stDepositDue,
  confirmed: styles.stConfirmed,
  full: styles.stFull,
  weather: styles.stWeather,
  blocked: styles.stBlocked,
  off: styles.stOff,
};

const LEGEND: CellStatus[] = ["open", "pending", "deposit_due", "confirmed", "full", "weather", "blocked"];

/** Dashboard card: the next 14 or 30 nights, one row per boat. */
export default function BookingStrip({ boats, nights, today, cells }: Props) {
  const [span, setSpan] = useState<14 | 30>(14);
  const shown = nights.slice(0, span);

  return (
    <section className={`${styles.card} ${styles.stripCard} ${styles.wrap}`}>
      <div className={styles.stripHead}>
        <div>
          <span className={styles.kicker}>Booking calendar</span>
          <h2>Next {span} nights</h2>
        </div>
        <div className={styles.stripTools}>
          <div className={styles.tabs} role="group" aria-label="Nights shown">
            {([14, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.tab} ${span === n ? styles.tabOn : ""}`}
                aria-pressed={span === n}
                onClick={() => setSpan(n)}
              >
                {n} nights
              </button>
            ))}
          </div>
          <Link href="/admin/schedule" className={styles.navBtn}>
            Full calendar
          </Link>
        </div>
      </div>

      {boats.length === 0 ? (
        <p className={styles.empty}>No active boats.</p>
      ) : (
        <div className={styles.scroller}>
          <table className={`${styles.rows} ${styles.stripRows} ${span === 30 ? styles.stripWide : ""}`}>
            <thead>
              <tr>
                <th className={styles.boatCol} scope="col">
                  Boat
                </th>
                {shown.map((n) => {
                  const wd = weekdayIdx(n);
                  return (
                    <th
                      key={n}
                      scope="col"
                      className={[
                        styles.colHead,
                        wd >= 4 && wd <= 5 ? styles.colWeekend : "",
                        n === today ? styles.colToday : "",
                      ].join(" ")}
                    >
                      <span>{WEEKDAYS_EN[wd].slice(0, 2)}</span>
                      <b>{dayOfMonth(n)}</b>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {boats.map((boat) => (
                <tr key={boat.id}>
                  <th className={styles.boatCol} scope="row">
                    <b>{boat.code}</b>
                    <small>
                      {boat.capacity} pax · {boat.jettyName}
                    </small>
                  </th>
                  {shown.map((n, i) => {
                    const c = cells[boat.id][i];
                    return (
                      <td key={n}>
                        <Link
                          href={`/admin/schedule?view=day&date=${n}#boat-${boat.id}`}
                          className={`${styles.cell} ${STATUS_CLASS[c.status]}`}
                          title={`${boat.code}, ${dayLabel(n)}: ${CELL_LABEL[c.status]} · ${c.pax}/${boat.capacity} pax · ${c.note}`}
                        >
                          <b>{c.status === "blocked" || c.status === "off" ? "–" : c.pax || "·"}</b>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className={styles.legend}>
        {LEGEND.map((s) => (
          <li key={s}>
            <span className={`${styles.swatch} ${STATUS_CLASS[s]}`} />
            {CELL_LABEL[s]}
          </li>
        ))}
        <li>Numbers are pax booked. Tap a night to see its bookings.</li>
      </ul>
    </section>
  );
}
