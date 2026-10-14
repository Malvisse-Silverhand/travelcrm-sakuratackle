"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCan3D } from "@/components/three/LazyBoatStage";
import type { ClockMode, HarbourBoat } from "@/components/three/harbour/HarbourScene";
import { STATUS_LABEL, statusPill } from "./bookingStatus";
import {
  clockLabel,
  fromCycle,
  myMinutes,
  phaseLabel,
  sailingState,
  toCycle,
} from "@/lib/harbour";
import styles from "../../app/admin/admin.module.css";

// three.js stays out of the dashboard's own bundle; it loads with the scene.
const HarbourScene = dynamic(() => import("@/components/three/harbour/HarbourScene"), {
  ssr: false,
});

export type ManifestRow = { id: string; ref: string; full_name: string; pax: number; status: string };

type Props = {
  boats: HarbourBoat[];
  manifests: Record<string, ManifestRow[]>;
  /** e.g. "Tonight, 14 Oktober 2026" */
  nightLabel: string;
};

/** Harbour HQ: the fleet at Jeti Marang, played out on tonight's bookings. */
export default function HarbourHQ({ boats, manifests, nightLabel }: Props) {
  const can3D = useCan3D();
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [mode, setMode] = useState<ClockMode>("live");
  const [shownCycle, setShownCycle] = useState(() => toCycle(myMinutes()));

  // The scene advances time inside its render loop; it shares these refs so
  // the clock never round-trips through React state every frame.
  const cycleRef = useRef(toCycle(myMinutes()));
  const modeRef = useRef<ClockMode>("live");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // The slider and clock label follow the scene's time a few times a second.
  useEffect(() => {
    const id = window.setInterval(() => setShownCycle(cycleRef.current), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Demo books every boat at 70% so the trip can be watched on a quiet night.
  const shown: HarbourBoat[] = useMemo(
    () =>
      demo
        ? boats.map((b) => ({
            ...b,
            sailing: !b.weather && !b.blocked,
            pax: b.sailing ? b.pax : Math.ceil(b.capacity * 0.7),
          }))
        : boats,
    [boats, demo]
  );

  const sailingCount = shown.filter((b) => b.sailing).length;
  const pick = shown.find((b) => b.id === selected) ?? null;
  const pickIndex = pick ? shown.indexOf(pick) : -1;
  const pickPhase =
    pick && pick.sailing ? phaseLabel(sailingState(shownCycle, pickIndex).phase) : "At the jetty";

  return (
    <div className={styles.hqCard}>
      <div className={styles.hqHead}>
        <div>
          <span className={styles.hqKicker}>Harbour HQ · Jeti Marang</span>
          <div className={styles.hqTitle}>
            {nightLabel}: {sailingCount} of {shown.length} boats sailing
            {demo && <span className={styles.hqDemo}>Demo, not real bookings</span>}
          </div>
        </div>
        <div className={styles.hqControls}>
          <span className={styles.hqClock}>{clockLabel(fromCycle(shownCycle))}</span>
          <button
            type="button"
            className={`${styles.hqBtn} ${mode === "live" ? styles.hqBtnOn : ""}`}
            onClick={() => setMode("live")}
          >
            Live
          </button>
          <button
            type="button"
            className={`${styles.hqBtn} ${mode === "play" ? styles.hqBtnOn : ""}`}
            onClick={() => setMode(mode === "play" ? "pause" : "play")}
          >
            {mode === "play" ? "Pause" : "Play day"}
          </button>
          <label className={styles.hqDemoToggle}>
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demo
          </label>
        </div>
      </div>

      <div ref={box} className={styles.hqStage}>
        {can3D ? (
          <HarbourScene
            boats={shown}
            cycleRef={cycleRef}
            modeRef={modeRef}
            startCycle={shownCycle}
            selected={selected}
            onSelect={setSelected}
            running={visible}
          />
        ) : (
          <div className={styles.hqFallback}>
            {shown.map((b) => (
              <button key={b.id} type="button" className={styles.hqFallbackBoat} onClick={() => setSelected(b.id)}>
                <b>{b.code}</b>
                <span>{b.sailing ? `${b.pax} pax tonight` : b.weather ? "Weather hold" : "At the jetty"}</span>
              </button>
            ))}
          </div>
        )}

        {pick && (
          <div className={styles.hqPanel}>
            <div className={styles.hqPanelHead}>
              <div>
                <b>{pick.code}</b>
                <span className={styles.dtSub}>
                  {pick.weather ? "Weather hold" : pick.blocked ? "Night blocked" : pickPhase}
                  {pick.sailing ? ` · ${pick.pax}/${pick.capacity} pax` : ""}
                </span>
              </div>
              <button type="button" className={styles.hqClose} onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            {(manifests[pick.id] ?? []).length === 0 ? (
              <p className={styles.dtSub} style={{ margin: "8px 0 0" }}>
                {demo && pick.sailing ? "Demo crew, no real bookings." : "No bookings tonight."}
              </p>
            ) : (
              <ul className={styles.hqManifest}>
                {manifests[pick.id].map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/bookings/${m.id}`}>
                      <b>{m.full_name}</b> · {m.pax} pax
                    </Link>
                    <span className={statusPill(m.status)}>{STATUS_LABEL[m.status] ?? m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className={styles.hqTimeline}>
        <input
          type="range"
          min={0}
          max={1439}
          value={Math.floor(shownCycle)}
          aria-label="Time of day"
          onChange={(e) => {
            cycleRef.current = Number(e.target.value);
            setShownCycle(Number(e.target.value));
            setMode("pause");
          }}
        />
        <div className={styles.hqTicks}>
          <span>07:30</span>
          <span>Boarding 15:30</span>
          <span>Sail 16:45</span>
          <span>Lubuk 18:00</span>
          <span>Home 06:00</span>
          <span>07:30</span>
        </div>
      </div>
    </div>
  );
}
