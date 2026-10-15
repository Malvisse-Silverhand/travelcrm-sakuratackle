"use client";

import { useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import LazyBoatStage, { useCan3D } from "@/components/three/LazyBoatStage";
import { useBooking } from "../BookingState";
import { formatLongDate } from "@/lib/season";
import pub from "@/app/public.module.css";
import styles from "@/app/home.module.css";

export type FleetBoat = {
  id: string;
  code: string;
  display_name: string | null;
  kind: string | null;
  length_ft: number | null;
  beam: string | null;
  material: string | null;
  capacity: number;
  daily_rate: number | null;
  description: string | null;
  photo_url: string | null;
  /** Jetty the boat sails from (jetties.id). */
  jetty_id: string;
};

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

/** One boat at a time: the boat's real photo large, its live low-poly model
 *  (night, lamps on, the group on deck) underneath, and the specs beside. Only boats big enough for the
 *  chosen group are offered, which is why this is a client component — `pax`
 *  is shared with the hero search and the booking calendar.
 *
 *  Switching boats re-uses the same canvas rather than remounting it, so the
 *  page never holds more than one WebGL context. */
export default function FleetShowcase({ boats }: { boats: FleetBoat[] }) {
  const { pax, selected } = useBooking();
  const can3D = useCan3D();
  const fleet = boats.filter((b) => b.capacity >= pax);

  // Chosen by code rather than index so the choice survives the list being
  // re-filtered when the group size changes.
  const [code, setCode] = useState<string | null>(null);
  const [dir, setDir] = useState(1);
  const found = fleet.findIndex((b) => b.code === code);
  const idx = found >= 0 ? found : 0;
  const boat = fleet[idx];

  const go = (delta: number) => {
    if (fleet.length < 2) return;
    setDir(delta);
    setCode(fleet[(idx + delta + fleet.length) % fleet.length].code);
  };

  // Horizontal swipe on the stage; vertical movement is left to the page.
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <section id="armada" className={`${styles.screen} ${styles.fleetScreen}`}>
      <div className={`${pub.container} ${styles.fleetInner}`}>
        <div className={styles.fleetHead}>
          <div>
            <span className={pub.eyebrow}>Armada &amp; Kemudi Kami</span>
            <h2 className={pub.sectionTitle}>Bot yang sesuai untuk {pax} pax</h2>
          </div>
          <span className={styles.fleetCount}>
            {fleet.length} bot sesuai
            {selected ? ` · ${formatLongDate(selected)}` : ""}
          </span>
        </div>

        {boat ? (
          <div className={styles.fleetBody}>
            <div className={styles.fleetMedia}>
              <div
                className={styles.photoWrap}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  touch.current = { x: t.clientX, y: t.clientY };
                }}
                onTouchEnd={(e) => {
                  const start = touch.current;
                  touch.current = null;
                  if (!start) return;
                  const t = e.changedTouches[0];
                  const dx = t.clientX - start.x;
                  const dy = t.clientY - start.y;
                  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
                }}
              >
                {boat.photo_url ? (
                  // Keyed so each boat's photo fades in rather than swapping.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={boat.id}
                    src={boat.photo_url}
                    alt={`Foto bot ${boat.display_name ?? boat.code}`}
                    className={styles.boatPhoto}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.photoEmpty}>Foto bot akan datang</div>
                )}
                {fleet.length > 1 && (
                  <div className={styles.stageNav}>
                    <button
                      type="button"
                      className={styles.stageBtn}
                      onClick={() => go(-1)}
                      aria-label="Bot sebelum"
                    >
                      &#8592;
                    </button>
                    <span className={styles.stageCount}>
                      {idx + 1} / {fleet.length}
                    </span>
                    <button
                      type="button"
                      className={styles.stageBtn}
                      onClick={() => go(1)}
                      aria-label="Bot seterusnya"
                    >
                      &#8594;
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden where WebGL is unavailable: its fallback would only
                  repeat the photo above. */}
              {can3D !== false && (
                <div className={styles.stageWrap}>
                  <LazyBoatStage
                    className={styles.stage}
                    code={boat.code}
                    lengthFt={boat.length_ft}
                    beam={boat.beam}
                    pax={Math.min(pax, boat.capacity)}
                    mode="night"
                    fallbackAlt={`Model 3D bot ${boat.display_name ?? boat.code}`}
                  />
                  <span className={styles.stageTag}>Model 3D · warna ikut bot sebenar</span>
                </div>
              )}
            </div>

            <div className={styles.fleetInfo}>
              <div className={styles.boatTabs} role="tablist" aria-label="Pilih bot">
                {fleet.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={i === idx}
                    className={`${styles.boatTab} ${i === idx ? styles.boatTabOn : ""}`}
                    onClick={() => {
                      setDir(i >= idx ? 1 : -1);
                      setCode(b.code);
                    }}
                  >
                    {b.code}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <m.article
                  key={boat.id}
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={styles.boatDetail}
                >
                  <BoatDetail boat={boat} />
                </m.article>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className={styles.fleetEmpty}>
            Tiada bot untuk saiz group ini. WhatsApp kami — kami boleh gabung dua bot untuk
            group besar.
          </div>
        )}
      </div>
    </section>
  );
}

function BoatDetail({ boat }: { boat: FleetBoat }) {
  const name = boat.display_name ?? boat.code;
  return (
    <>
      <div className={styles.boatTop}>
        <div>
          {boat.kind && <span className={styles.boatKind}>{boat.kind}</span>}
          <h3 className={styles.boatName}>{name}</h3>
        </div>
      </div>

      {boat.description && <p className={styles.boatDesc}>{boat.description}</p>}

      <dl className={styles.boatSpecs}>
        <Spec label="Panjang" value={boat.length_ft ? `${boat.length_ft} Kaki` : "—"} />
        <Spec label="Lebar" value={boat.beam ?? "—"} />
        <Spec label="Kapasiti" value={`Max ${boat.capacity} Pax`} />
        <Spec label="Material" value={boat.material ?? "—"} />
      </dl>

      <div className={styles.boatFoot}>
        {boat.daily_rate !== null && (
          <div>
            <div className={styles.boatRate}>
              RM{Number(boat.daily_rate).toLocaleString("en-MY")}
            </div>
            <div className={styles.boatRateSub}>sewa harian</div>
          </div>
        )}
        <a href="#tempah" className={styles.boatCta}>
          Semak tarikh kosong
        </a>
      </div>
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.spec}>
      <dt className={styles.specLabel}>{label}</dt>
      <dd className={styles.specValue}>{value}</dd>
    </div>
  );
}
