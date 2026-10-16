"use client";

import { useRouter } from "next/navigation";
import styles from "./schedule.module.css";

export type FilterBoat = { id: string; code: string; jettyId: string; vendorKey: string };
type Option = { id: string; name: string };

type Props = {
  /** Current params other than the filters (view, date). */
  base: Record<string, string>;
  jetty: string;
  vendor: string;
  boat: string;
  jetties: Option[];
  /** Empty for vendors, who only ever see their own boats. */
  vendors: Option[];
  boats: FilterBoat[];
};

export default function ScheduleFilters({ base, jetty, vendor, boat, jetties, vendors, boats }: Props) {
  const router = useRouter();

  function go(next: { jetty?: string; vendor?: string; boat?: string }) {
    const f = { jetty, vendor, boat, ...next };
    // A boat that no longer matches the location or vendor drops out.
    const pick = boats.find((b) => b.id === f.boat);
    if (pick && ((f.jetty && pick.jettyId !== f.jetty) || (f.vendor && pick.vendorKey !== f.vendor))) {
      f.boat = "";
    }
    const q = new URLSearchParams(base);
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    router.push(`/admin/schedule?${q.toString()}`);
  }

  const boatOptions = boats.filter(
    (b) => (!jetty || b.jettyId === jetty) && (!vendor || b.vendorKey === vendor)
  );

  return (
    <div className={styles.filters}>
      <label className={styles.filter}>
        Location
        <select value={jetty} onChange={(e) => go({ jetty: e.target.value })}>
          <option value="">All locations</option>
          {jetties.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </label>
      {vendors.length > 0 && (
        <label className={styles.filter}>
          Vendor
          <select value={vendor} onChange={(e) => go({ vendor: e.target.value })}>
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.filter}>
        Boat
        <select value={boat} onChange={(e) => go({ boat: e.target.value })}>
          <option value="">All boats</option>
          {boatOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code}
            </option>
          ))}
        </select>
      </label>
      {(jetty || vendor || boat) && (
        <button type="button" className={styles.clear} onClick={() => go({ jetty: "", vendor: "", boat: "" })}>
          Clear filters
        </button>
      )}
    </div>
  );
}
