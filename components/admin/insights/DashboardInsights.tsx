"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/public/book/Icon";
import { formatLongDate } from "@/lib/season";
import type { Insight, Task } from "@/lib/insights";
import styles from "./insights.module.css";

const SHOW = 8;

/** Dashboard: headline insights, then two checklists: before the trip
 *  (next 30 days) and after it (last 14 days). Every item links to where
 *  it gets done, and disappears once it is. */
export default function DashboardInsights({ insights, upcoming, past }: { insights: Insight[]; upcoming: Task[]; past: Task[] }) {
  return (
    <section className={styles.wrap} aria-label="Insights and checklists">
      {insights.length > 0 && (
        <div className={styles.insights}>
          {insights.map((i, n) => {
            const body = (
              <>
                <span className={`${styles.iIcon} ${styles[`tone_${i.tone}`]}`}>
                  <Icon name={i.icon} size={20} />
                </span>
                <span>
                  <b>{i.title}</b>
                  <small>{i.body}</small>
                </span>
              </>
            );
            return i.href ? (
              <Link key={n} href={i.href} className={styles.insight} target={i.href.startsWith("http") ? "_blank" : undefined}>
                {body}
              </Link>
            ) : (
              <div key={n} className={styles.insight}>
                {body}
              </div>
            );
          })}
        </div>
      )}
      <div className={styles.lists}>
        <Checklist title="Before the trip" sub="Next 30 days" icon="anchor" tasks={upcoming} empty="Everything is ready for the next 30 days." />
        <Checklist title="After the trip" sub="Last 14 days" icon="fish" tasks={past} empty="All recent trips are closed off." />
      </div>
    </section>
  );
}

function Checklist({ title, sub, icon, tasks, empty }: { title: string; sub: string; icon: string; tasks: Task[]; empty: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, SHOW);
  return (
    <div className={styles.list}>
      <div className={styles.listHead}>
        <span className={styles.listIcon}>
          <Icon name={icon} size={18} />
        </span>
        <span>
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        <span className={styles.count}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className={styles.empty}>
          <Icon name="checkCircle" size={18} /> {empty}
        </p>
      ) : (
        <ul>
          {shown.map((t, i) => {
            const head = i === 0 || shown[i - 1].night !== t.night;
            return (
              <li key={t.key}>
                {head && <span className={styles.night}>{formatLongDate(t.night)}</span>}
                <Link href={t.href} className={styles.task} target={t.href.startsWith("http") ? "_blank" : undefined}>
                  <span className={`${styles.tIcon} ${styles[`tone_${t.tone}`]}`}>
                    <Icon name={t.icon} size={15} />
                  </span>
                  <span className={styles.tText}>
                    {t.text}
                    <small data-pii="name">
                      {t.name} · {t.ref} · {t.boat}
                    </small>
                  </span>
                  <span aria-hidden="true" className={styles.chev}>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length > SHOW && (
        <button type="button" className={styles.more} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${tasks.length}`}
        </button>
      )}
    </div>
  );
}
