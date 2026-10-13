"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import LazyBoatStage from "@/components/three/LazyBoatStage";
import type { MatStyleName } from "@/components/three/Mat";
import styles from "./review.module.css";

const UPLOADS = "https://sakuratackle.com/wp-content/uploads/2026/02/";

// Mirrors the boats table. Hard-coded here because the review page has to
// work while the database is paused; the booking pages read the real rows.
const FLEET = [
  { code: "PUTERA KAPAS", name: "SpeedBoat \"Putera Kapas\"", lengthFt: 42, beam: "10 Kaki", capacity: 8, photo: UPLOADS + "Speedboat.jpeg" },
  { code: "KNF 6241", name: "KNF 6241", lengthFt: 63, beam: "16.5 Kaki", capacity: 15, photo: UPLOADS + "KNF-6241.jpeg" },
  { code: "TRF 1005", name: "TRF 1005", lengthFt: 56, beam: "15 Kaki", capacity: 15, photo: UPLOADS + "TRF-1005.jpeg" },
  { code: "TRF 92", name: "TRF 92", lengthFt: 51, beam: "14 Kaki", capacity: 10, photo: UPLOADS + "TRF-92.jpeg" },
  { code: "TRA 1539", name: "TRA 1539", lengthFt: 51, beam: "14 Kaki", capacity: 10, photo: UPLOADS + "TFA-1539.jpeg" },
];

export default function FleetReview() {
  // ?boat=TRF%201005&mode=night&style=toon&pax=12&still=1, so a view can be
  // shared; read once as initial state, the controls take over from there.
  const q = useSearchParams();
  const [idx, setIdx] = useState(() => {
    const i = FLEET.findIndex((b) => b.code === q.get("boat"));
    return i >= 0 ? i : 2;
  });
  const [mode, setMode] = useState<"night" | "day">(() => (q.get("mode") === "night" ? "night" : "day"));
  const [style, setStyle] = useState<MatStyleName>(() => (q.get("style") === "toon" ? "toon" : "faceted"));
  const [pax, setPax] = useState(() => {
    const p = Number(q.get("pax"));
    return q.has("pax") && Number.isFinite(p) ? p : 8;
  });
  // ?still=1 freezes the camera and the sea, for screenshots and close checks.
  const still = q.get("still") === "1";

  const boat = FLEET[idx];
  const shownPax = Math.min(pax, boat.capacity);

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <div>
          <h1 className={styles.title}>Fleet model review</h1>
          <p className={styles.sub}>Drag to orbit. Compare each model with the real boat photo.</p>
        </div>
        <div className={styles.toggles}>
          <Toggle value={mode} options={[["day", "Day"], ["night", "Night"]]} onChange={setMode} />
          <Toggle
            value={style}
            options={[["faceted", "Public site"], ["toon", "Harbour HQ"]]}
            onChange={setStyle}
          />
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Boats">
        {FLEET.map((b, i) => (
          <button
            key={b.code}
            type="button"
            className={`${styles.tab} ${i === idx ? styles.tabOn : ""}`}
            onClick={() => setIdx(i)}
          >
            {b.code}
          </button>
        ))}
      </nav>

      <section className={styles.stageWrap}>
        <LazyBoatStage
          key={boat.code}
          className={styles.stage}
          code={boat.code}
          lengthFt={boat.lengthFt}
          beam={boat.beam}
          pax={shownPax}
          mode={mode}
          style={style}
          interactive={!still}
          reducedMotion={still || undefined}
          fallbackSrc={boat.photo}
          fallbackAlt={`3D model of ${boat.name}`}
        />
        <figure className={styles.photo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={boat.photo} alt={`Photo of ${boat.name}`} />
          <figcaption>Real boat</figcaption>
        </figure>
      </section>

      <footer className={styles.controls}>
        <label className={styles.slider}>
          <span>
            Passengers <b>{shownPax}</b> / {boat.capacity}
          </span>
          <input
            type="range"
            min={0}
            max={15}
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
          />
        </label>
        <dl className={styles.specs}>
          <div><dt>Length</dt><dd>{boat.lengthFt} ft</dd></div>
          <div><dt>Beam</dt><dd>{boat.beam.replace(" Kaki", " ft")}</dd></div>
          <div><dt>Capacity</dt><dd>{boat.capacity} pax</dd></div>
        </dl>
      </footer>
    </main>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.toggle} role="group">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          className={`${styles.toggleBtn} ${value === v ? styles.toggleOn : ""}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
