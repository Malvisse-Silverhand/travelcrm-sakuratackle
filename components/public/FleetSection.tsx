"use client";

import { useBooking } from "./BookingState";
import { formatLongDate } from "@/lib/season";
import styles from "@/app/public.module.css";

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
};

/** P2 — the fleet grid. Shows only boats big enough for the chosen group,
 *  which is why it is a client component: `pax` lives in shared state and is
 *  also driven by the hero search and the calendar's chips. */
export default function FleetSection({ boats }: { boats: FleetBoat[] }) {
  const { pax, selected } = useBooking();

  const fleet = boats.filter((b) => b.capacity >= pax);

  return (
    <section id="armada" className={styles.fleetSection}>
      <div className={styles.container}>
        <div className={styles.fleetHead}>
          <div>
            <span className={styles.eyebrow}>Armada &amp; Kemudi Kami</span>
            <h2 className={styles.sectionTitle}>Bot yang sesuai untuk {pax} pax</h2>
          </div>
          <span className={styles.fleetCount}>
            {fleet.length} bot sesuai
            {selected ? ` · ${formatLongDate(selected)}` : ""}
          </span>
        </div>

        {fleet.length > 0 ? (
          <div className={styles.fleetGrid}>
            {fleet.map((boat) => (
              <BoatCard key={boat.id} boat={boat} />
            ))}
          </div>
        ) : (
          <div className={styles.fleetEmpty}>
            Tiada bot untuk saiz group ini. WhatsApp kami — kami boleh gabung dua bot
            untuk group besar.
          </div>
        )}
      </div>
    </section>
  );
}

function BoatCard({ boat }: { boat: FleetBoat }) {
  const name = boat.display_name ?? boat.code;

  return (
    <article className={styles.boatCard}>
      <div className={styles.boatMedia}>
        {boat.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={boat.photo_url}
            alt={`Foto bot ${name}`}
            className={styles.boatPhoto}
            loading="lazy"
          />
        ) : (
          <div className={styles.boatPhotoEmpty}>Foto bot {name}</div>
        )}
        {boat.kind && <span className={styles.boatKind}>{boat.kind}</span>}
      </div>

      <div className={styles.boatBody}>
        <div className={styles.boatTitleRow}>
          <h3 className={styles.boatName}>{name}</h3>
          {boat.daily_rate !== null && (
            <div className={styles.boatRateBox}>
              <div className={styles.boatRate}>
                RM{Number(boat.daily_rate).toLocaleString("en-MY")}
              </div>
              <div className={styles.boatRateSub}>sewa harian</div>
            </div>
          )}
        </div>

        {boat.description && <p className={styles.boatDesc}>{boat.description}</p>}

        <dl className={styles.boatSpecs}>
          <Spec label="Panjang" value={boat.length_ft ? `${boat.length_ft} Kaki` : "—"} />
          <Spec label="Lebar" value={boat.beam ?? "—"} />
          <Spec label="Kapasiti" value={`Max ${boat.capacity} Pax`} />
          <Spec label="Material" value={boat.material ?? "—"} />
        </dl>

        <div className={styles.boatFoot}>
          <a href="#tempah" className={styles.boatCta}>
            Pilih Bot Ini
          </a>
        </div>
      </div>
    </article>
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
