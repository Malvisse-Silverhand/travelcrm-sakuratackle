"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import type { Step } from "@/lib/content/site";
import styles from "@/app/home.module.css";

const SAIL_SECONDS = 3.6;

/** The trip steps as a route from the jetty to the lubuk: the first time the
 *  list comes into view a small boat sails down it and each stop lights up as
 *  the boat reaches it. */
export default function TripTimeline({ steps }: { steps: Step[] }) {
  const route = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const inView = useInView(list, { once: true, amount: 0.45 });
  const reduce = useReducedMotion();

  // The line runs from the centre of the first stop's number to the centre of
  // the last one. Stops differ in height, so it is measured, not assumed.
  const [span, setSpan] = useState<{ top: number; height: number; stops: number[] } | null>(
    null
  );

  useEffect(() => {
    const box = route.current;
    if (!box) return;
    const measure = () => {
      const nums = Array.from(box.querySelectorAll<HTMLElement>("[data-stop]"));
      if (nums.length < 2) return;
      const base = box.getBoundingClientRect().top;
      const centres = nums.map((n) => {
        const r = n.getBoundingClientRect();
        return r.top - base + r.height / 2;
      });
      const top = centres[0];
      const height = centres[centres.length - 1] - top;
      setSpan({ top, height, stops: centres.map((c) => (height > 0 ? (c - top) / height : 0)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const sail = reduce ? 0 : SAIL_SECONDS;

  return (
    <div ref={route} className={styles.route}>
      {span && (
        <>
          <div
            className={styles.routeLine}
            style={{ top: span.top, height: span.height }}
            aria-hidden="true"
          >
            <m.div
              className={styles.routeFill}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : undefined}
              transition={{ duration: sail, ease: "linear" }}
            />
          </div>
          <div className={styles.routeBoatLane} style={{ top: span.top }} aria-hidden="true">
            <m.div
              className={styles.routeBoat}
              initial={{ y: 0 }}
              animate={inView ? { y: span.height } : undefined}
              transition={{ duration: sail, ease: "linear" }}
            >
              <BoatGlyph />
            </m.div>
          </div>
        </>
      )}

      <ol ref={list} className={styles.stops}>
        {steps.map((s, i) => {
          const at = span?.stops[i] ?? i / Math.max(1, steps.length - 1);
          return (
            <m.li
              key={s.n}
              className={styles.stop}
              initial={{ opacity: 0.45 }}
              animate={inView ? { opacity: 1 } : undefined}
              transition={{ delay: at * sail, duration: 0.35 }}
            >
              <m.span
                data-stop
                className={styles.stopNum}
                initial={{ backgroundColor: "#ede7fb", color: "#2e1d6b" }}
                animate={
                  inView ? { backgroundColor: "#2e1d6b", color: "#ffe39a" } : undefined
                }
                transition={{ delay: at * sail, duration: 0.35 }}
              >
                {s.n}
              </m.span>
              <div>
                <div className={styles.stopTitle}>{s.title}</div>
                <div className={styles.stopBody}>{s.body}</div>
              </div>
            </m.li>
          );
        })}
      </ol>
    </div>
  );
}

/** A side-on candat boat with its lamp lit, drawn small enough to ride the
 *  route line. */
function BoatGlyph() {
  return (
    <svg viewBox="0 0 40 28" width="40" height="28" aria-hidden="true">
      <circle cx="22" cy="9" r="8" fill="#5dff9c" opacity="0.35" />
      <path d="M4 17h32l-5 7H9z" fill="#2e1d6b" />
      <path d="M4 17h32l-1 1.6H5z" fill="#ffb800" />
      <rect x="13" y="9" width="11" height="8" rx="1.5" fill="#f5f2fe" />
      <rect x="15" y="11" width="3" height="3" fill="#2e1d6b" />
      <rect x="19.5" y="11" width="3" height="3" fill="#2e1d6b" />
      <path d="M11 9h16" stroke="#2e1d6b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22" cy="7.2" r="1.8" fill="#5dff9c" />
    </svg>
  );
}
