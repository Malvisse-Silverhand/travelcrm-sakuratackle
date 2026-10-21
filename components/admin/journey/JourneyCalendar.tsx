"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/public/book/Icon";
import { JOURNEY, type JourneyEvent, type JourneyType } from "@/lib/journey";
import { formatRM } from "@/lib/date";
import { formatLongDate } from "@/lib/season";
import styles from "./journey.module.css";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Props = {
  events: JourneyEvent[];
  /** "2026-10" */
  month: string;
  today: string;
  boats: string[];
  /** Vendors see no money, so no payment filters. */
  showMoney: boolean;
};

function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** The customer journey as a month calendar: booked, paid, departure and
 *  outcome as timed events. Pick a customer to see their whole timeline. */
export default function JourneyCalendar({ events, month, today, boats, showMoney }: Props) {
  const types = (Object.keys(JOURNEY) as JourneyType[]).filter((t) => showMoney || (t !== "deposit" && t !== "paid_full"));
  const [on, setOn] = useState<Set<JourneyType>>(() => new Set(types));
  const [boat, setBoat] = useState("");
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<string | null>(null);

  const [y, m] = month.split("-").map(Number);
  const first = iso(y, m, 1);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        on.has(e.type) &&
        (!boat || e.boat === boat) &&
        (!person || e.phoneKey === person) &&
        (!q || e.name.toLowerCase().includes(q) || e.ref.toLowerCase().includes(q) || e.phoneKey.includes(q.replace(/\D/g, "") || "~"))
    );
  }, [events, on, boat, person, query]);

  const byDay = useMemo(() => {
    const map = new Map<string, JourneyEvent[]>();
    for (const e of shown) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return map;
  }, [shown]);

  const timeline = person ? events.filter((e) => e.phoneKey === person) : [];
  const personName = timeline[0]?.name;
  const monthEvents = shown.filter((e) => e.date.startsWith(month));
  const count = (t: JourneyType) => monthEvents.filter((e) => e.type === t).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.nav}>
          <Link href={`?m=${prev}`} className={styles.navBtn} aria-label="Previous month">
            ‹
          </Link>
          <Link href={`?m=${today.slice(0, 7)}`} className={styles.navBtn}>
            This month
          </Link>
          <Link href={`?m=${next}`} className={styles.navBtn} aria-label="Next month">
            ›
          </Link>
          <h2>
            {MONTHS[m - 1]} {y}
          </h2>
        </div>
        <div className={styles.filters}>
          <select aria-label="Boat" value={boat} onChange={(e) => setBoat(e.target.value)}>
            <option value="">All boats</option>
            {boats.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <input type="search" placeholder="Find a customer…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className={styles.legend} role="group" aria-label="Show events">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={on.has(t)}
            className={`${styles.legendBtn} ${styles[`tone_${JOURNEY[t].tone}`]} ${on.has(t) ? "" : styles.off}`}
            onClick={() =>
              setOn((cur) => {
                const n = new Set(cur);
                if (n.has(t)) n.delete(t);
                else n.add(t);
                return n;
              })
            }
          >
            <Icon name={JOURNEY[t].icon} size={14} /> {JOURNEY[t].label} <b>{count(t)}</b>
          </button>
        ))}
      </div>

      {person && (
        <section className={styles.timeline}>
          <div className={styles.timelineHead}>
            <b>Journey of {personName}</b>
            <button type="button" onClick={() => setPerson(null)}>
              Show everyone
            </button>
          </div>
          <ol>
            {timeline.map((e) => (
              <li key={e.key} className={styles[`tone_${JOURNEY[e.type].tone}`]}>
                <span className={styles.dot}>
                  <Icon name={JOURNEY[e.type].icon} size={14} />
                </span>
                <span>
                  <b>{JOURNEY[e.type].label}</b> · {formatLongDate(e.date)}, {e.time}
                  {e.amount ? ` · ${formatRM(e.amount)}` : ""}
                  <small>
                    <Link href={`/admin/bookings/${e.bookingId}`}>{e.ref}</Link> · {e.boat}
                  </small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className={styles.scroller}>
        <div className={styles.grid}>
          {DOW.map((d) => (
            <div key={d} className={styles.dow}>
              {d}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad${i}`} className={styles.pad} />
          ))}
          {Array.from({ length: daysIn }, (_, i) => {
            const date = iso(y, m, i + 1);
            const list = byDay.get(date) ?? [];
            return (
              <div key={date} className={`${styles.day} ${date === today ? styles.today : ""}`}>
                <span className={styles.num}>{i + 1}</span>
                {list.slice(0, 6).map((e) => (
                  <button
                    key={e.key}
                    type="button"
                    className={`${styles.ev} ${styles[`tone_${JOURNEY[e.type].tone}`]}`}
                    title={`${JOURNEY[e.type].label}: ${e.name} (${e.ref}, ${e.boat}) at ${e.time}${e.amount ? `, ${formatRM(e.amount)}` : ""}`}
                    onClick={() => setPerson(e.phoneKey)}
                  >
                    <Icon name={JOURNEY[e.type].icon} size={12} />
                    <span className={styles.evTime}>{e.time}</span>
                    <span className={styles.evName} data-pii="name">
                      {e.name.split(" ")[0]}
                    </span>
                  </button>
                ))}
                {list.length > 6 && <span className={styles.more}>+{list.length - 6} more</span>}
              </div>
            );
          })}
        </div>
      </div>
      <p className={styles.hint}>Tap an event to see that customer&apos;s whole journey. Departure is the sailing time, {"16:45"}.</p>
    </div>
  );
}
