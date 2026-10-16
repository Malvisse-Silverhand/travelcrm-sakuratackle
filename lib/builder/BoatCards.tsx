"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { perPax, rm } from "@/lib/content/booking";
import styles from "./blocks.module.css";

type Boat = {
  id: string;
  code: string;
  display_name: string | null;
  kind: string | null;
  capacity: number;
  daily_rate: number | null;
  photo_url: string | null;
};

/** Live boat cards for a built page: always today's boats, photos and rates
 *  (boats are publicly readable). Each card opens that boat's checkout. */
export default function BoatCards({ pax, limit }: { pax: number; limit: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [boats, setBoats] = useState<Boat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("boats")
      .select("id, code, display_name, kind, capacity, daily_rate, photo_url")
      .eq("active", true)
      .gte("capacity", pax)
      .order("sort_order")
      .order("code")
      .then(({ data }) => {
        if (!cancelled) setBoats((data ?? []) as Boat[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, pax]);

  if (boats === null) return <div className={styles.imgPlaceholder}>Loading boats…</div>;
  const shown = boats.filter((b) => Number(b.daily_rate) > 0).slice(0, limit || undefined);
  if (shown.length === 0) return <div className={styles.imgPlaceholder}>No boats for {pax} pax yet.</div>;

  return (
    <div className={styles.boatGrid}>
      {shown.map((b) => (
        <a key={b.id} href={`/book?boat=${b.id}&pax=${pax}`} className={styles.boatCard}>
          <span
            className={styles.boatPhoto}
            style={b.photo_url ? { backgroundImage: `url("${b.photo_url}")` } : undefined}
            role="img"
            aria-label={`Foto bot ${b.display_name ?? b.code}`}
          />
          <span className={styles.boatBody}>
            <span className={styles.boatName}>{b.display_name ?? b.code}</span>
            <span className={styles.boatMeta}>
              {b.kind ?? "Bot"} · max {b.capacity} pax
            </span>
            <span className={styles.boatRate}>
              {rm(Number(b.daily_rate))} <small>{perPax(Number(b.daily_rate), pax)}</small>
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
