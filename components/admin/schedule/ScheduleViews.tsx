import Link from "next/link";
import {
  CELL_LABEL,
  CELL_ORDER,
  type Cell,
  type CellStatus,
  type ScheduleBoat,
} from "@/lib/booking/schedule";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import { formatRM } from "@/lib/date";
import {
  MONTHS_EN,
  WEEKDAYS_EN,
  dayLabel,
  dayOfMonth,
  monthOf,
  weekdayIdx,
} from "./calendarDates";
import styles from "./schedule.module.css";

export const STATUS_CLASS: Record<CellStatus, string> = {
  open: styles.stOpen,
  pending: styles.stPending,
  deposit_due: styles.stDepositDue,
  confirmed: styles.stConfirmed,
  full: styles.stFull,
  weather: styles.stWeather,
  blocked: styles.stBlocked,
  off: styles.stOff,
};

const HEAT = [styles.h0, styles.h1, styles.h2, styles.h3, styles.h4];

/** Statuses where the boat has someone on it. */
const BOOKED: CellStatus[] = ["pending", "deposit_due", "confirmed", "full", "weather"];

/** cells[boatId][night] */
export type CellGrid = Record<string, Record<string, Cell>>;

type ViewProps = {
  boats: ScheduleBoat[];
  cells: CellGrid;
  nights: string[];
  today: string;
  /** Link to the day view of a night (filters kept). */
  dayHref: (night: string, boatId?: string) => string;
};

/** Short text for a cell: who is on it, or why it is empty. */
export function cellNote(c: Cell): string {
  if (c.status === "blocked") return c.blockedReason || "Blocked";
  if (c.bookings.length === 1) return c.bookings[0].full_name;
  if (c.bookings.length > 1) return `${c.bookings.length} bookings`;
  return CELL_LABEL[c.status];
}

export function Legend({ year = false }: { year?: boolean }) {
  return (
    <ul className={styles.legend}>
      {year ? (
        <>
          {["None", "Some", "Half", "Most", "All"].map((l, i) => (
            <li key={l}>
              <span className={`${styles.swatch} ${HEAT[i]}`} />
              {i === 0 ? "No boats booked" : `${l} booked`}
            </li>
          ))}
          <li>
            <span className={`${styles.swatch} ${styles.stOff}`} />
            Off season
          </li>
        </>
      ) : (
        CELL_ORDER.map((s) => (
          <li key={s}>
            <span className={`${styles.swatch} ${STATUS_CLASS[s]}`} />
            {CELL_LABEL[s]}
          </li>
        ))
      )}
    </ul>
  );
}

/* ---------------- Day ---------------- */

export function DayView({ boats, cells, nights }: ViewProps) {
  const night = nights[0];
  return (
    <div className={styles.dayGrid}>
      {boats.map((boat) => {
        const c = cells[boat.id][night];
        return (
          <section key={boat.id} id={`boat-${boat.id}`} className={styles.boatCard}>
            <div className={`${styles.boatHead} ${STATUS_CLASS[c.status]}`}>
              <div>
                <b>{boat.code}</b>
                <small>
                  {boat.jettyName} · {boat.vendorName} · {CELL_LABEL[c.status]}
                </small>
              </div>
              <span className={styles.boatPax}>
                {c.pax}/{c.capacity}
              </span>
            </div>
            {c.bookings.length > 0 ? (
              <ul className={styles.bookingList}>
                {c.bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`}>
                      <span>
                        <b data-pii="name">{b.full_name}</b>
                        <small>
                          {b.ref} · {b.pax} pax · {formatRM(Number(b.total_amount))}
                        </small>
                      </span>
                      <span className={statusPill(b.status)}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.boatNote}>
                {c.status === "blocked"
                  ? `Blocked${c.blockedReason ? `: ${c.blockedReason}` : ""}.`
                  : c.status === "off"
                  ? "Outside the season. No trips."
                  : "No bookings yet. Open for booking."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Week ---------------- */

export function NightHead({ night, today }: { night: string; today: string }) {
  const wd = weekdayIdx(night);
  return (
    <th
      className={[
        styles.colHead,
        wd >= 4 && wd <= 5 ? styles.colWeekend : "",
        night === today ? styles.colToday : "",
      ].join(" ")}
      scope="col"
    >
      <span>{WEEKDAYS_EN[wd]}</span>
      <b>{dayOfMonth(night)}</b>
    </th>
  );
}

export function BoatHead({ boat }: { boat: ScheduleBoat }) {
  return (
    <th className={styles.boatCol} scope="row">
      <b>{boat.code}</b>
      <small>
        {boat.capacity} pax · {boat.jettyName}
      </small>
    </th>
  );
}

export function WeekView({ boats, cells, nights, today, dayHref }: ViewProps) {
  return (
    <div className={styles.scroller}>
      <table className={`${styles.rows} ${styles.weekRows}`}>
        <thead>
          <tr>
            <th className={styles.boatCol} scope="col">
              Boat
            </th>
            {nights.map((n) => (
              <NightHead key={n} night={n} today={today} />
            ))}
          </tr>
        </thead>
        <tbody>
          {boats.map((boat) => (
            <tr key={boat.id}>
              <BoatHead boat={boat} />
              {nights.map((n) => {
                const c = cells[boat.id][n];
                return (
                  <td key={n}>
                    <Link
                      href={dayHref(n, boat.id)}
                      className={`${styles.cell} ${STATUS_CLASS[c.status]}`}
                      title={`${boat.code}, ${dayLabel(n)}: ${CELL_LABEL[c.status]}`}
                    >
                      <b>
                        {c.pax}/{c.capacity}
                      </b>
                      <small data-pii="name">{cellNote(c)}</small>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Month ---------------- */

export function MonthView({
  boats,
  cells,
  nights,
  today,
  dayHref,
  month,
}: ViewProps & { month: number }) {
  const single = boats.length === 1 ? boats[0] : null;
  return (
    <div className={styles.monthGrid}>
      {WEEKDAYS_EN.map((d) => (
        <div key={d} className={styles.monthDow}>
          {d}
        </div>
      ))}
      {nights.map((n) => {
        const dayCells = boats.map((b) => ({ boat: b, c: cells[b.id][n] }));
        const booked = dayCells.filter((x) => BOOKED.includes(x.c.status));
        const pax = dayCells.reduce((s, x) => s + x.c.pax, 0);
        return (
          <Link
            key={n}
            href={dayHref(n)}
            className={[
              styles.monthDay,
              monthOf(n) !== month ? styles.monthDayOut : "",
              n === today ? styles.monthDayToday : "",
            ].join(" ")}
          >
            <span className={styles.monthNum}>
              {dayOfMonth(n)}
              {!single && booked.length > 0 && (
                <small>
                  {booked.length}/{boats.length} · {pax} pax
                </small>
              )}
            </span>
            {single ? (
              <span className={`${styles.monthSingle} ${STATUS_CLASS[dayCells[0].c.status]}`}>
                <b>
                  {dayCells[0].c.pax}/{dayCells[0].c.capacity}
                </b>
                <small data-pii="name">{cellNote(dayCells[0].c)}</small>
              </span>
            ) : (
              <span className={styles.chips}>
                {dayCells.map(({ boat, c }) => (
                  <span
                    key={boat.id}
                    className={`${styles.chip} ${STATUS_CLASS[c.status]}`}
                    title={`${boat.code}: ${CELL_LABEL[c.status]}, ${c.pax}/${c.capacity} pax`}
                  >
                    {boat.code}
                  </span>
                ))}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ---------------- Year ---------------- */

export function YearView({
  boats,
  cells,
  nights,
  today,
  dayHref,
  monthHref,
}: ViewProps & { monthHref: (night: string) => string }) {
  const single = boats.length === 1 ? boats[0] : null;
  const byMonth: string[][] = Array.from({ length: 12 }, () => []);
  for (const n of nights) byMonth[monthOf(n) - 1].push(n);

  return (
    <div className={styles.yearGrid}>
      {byMonth.map((days, mi) => {
        let bookings = 0;
        let pax = 0;
        for (const n of days)
          for (const b of boats) {
            bookings += cells[b.id][n].bookings.length;
            pax += cells[b.id][n].pax;
          }
        const lead = days.length ? weekdayIdx(days[0]) : 0;
        return (
          <section key={mi} className={styles.miniMonth}>
            <div className={styles.miniHead}>
              <Link href={monthHref(days[0])}>{MONTHS_EN[mi]}</Link>
              <small>{bookings > 0 ? `${bookings} bkg · ${pax} pax` : "—"}</small>
            </div>
            <div className={styles.miniGrid}>
              {WEEKDAYS_EN.map((d) => (
                <span key={d} className={styles.miniDow}>
                  {d[0]}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`pad${i}`} />
              ))}
              {days.map((n) => {
                const dayCells = boats.map((b) => cells[b.id][n]);
                let cls: string;
                let title: string;
                if (single) {
                  cls = STATUS_CLASS[dayCells[0].status];
                  title = `${CELL_LABEL[dayCells[0].status]}, ${dayCells[0].pax}/${dayCells[0].capacity} pax`;
                } else {
                  const running = dayCells.filter((c) => c.status !== "off" && c.status !== "blocked");
                  const booked = dayCells.filter((c) => BOOKED.includes(c.status)).length;
                  if (running.length === 0 && booked === 0) {
                    cls = styles.stOff;
                    title = "Off season";
                  } else {
                    const share = booked / Math.max(running.length, booked, 1);
                    const level = booked === 0 ? 0 : share >= 1 ? 4 : share >= 0.6 ? 3 : share >= 0.3 ? 2 : 1;
                    cls = HEAT[level];
                    title = `${booked} of ${running.length} boats booked`;
                  }
                }
                return (
                  <Link
                    key={n}
                    href={dayHref(n)}
                    className={`${styles.miniDay} ${cls} ${n === today ? styles.miniToday : ""}`}
                    title={`${dayLabel(n)}: ${title}`}
                  >
                    {dayOfMonth(n)}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
