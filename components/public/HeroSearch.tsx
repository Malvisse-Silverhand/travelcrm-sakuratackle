"use client";

import { useState } from "react";
import { useBooking } from "./BookingState";
import { PAX_OPTIONS, monthFirstISO, monthLabel, monthLastISO } from "@/lib/season";
import styles from "@/app/public.module.css";

/** The white control that overlaps the bottom of the hero photo. Choosing a
 *  date here jumps the calendar to that month and selects the night; choosing
 *  a group size re-filters the fleet below. */
export default function HeroSearch() {
  const { pax, setPax, selected, pickDate, months } = useBooking();
  const [outOfSeason, setOutOfSeason] = useState<string | null>(null);

  // The native picker cannot offer a date outside the months on sale. Gaps
  // inside the range (a closed month) are caught by pickDate instead.
  const first = months[0];
  const last = months[months.length - 1];

  const onDate = (iso: string) => {
    if (!iso) return;
    if (pickDate(iso)) {
      setOutOfSeason(null);
      document.getElementById("tempah")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setOutOfSeason(
      first && last
        ? `Tarikh itu tiada trip. Cuba tarikh antara ${monthLabel(first)} dan ${monthLabel(last)}.`
        : "Tarikh trip belum dibuka. WhatsApp kami untuk tanya tarikh seterusnya."
    );
  };

  return (
    <>
      <div className={styles.search} role="search" aria-label="Cari slot trip">
        <label className={styles.searchField}>
          <span className={styles.searchLabel}>Tarikh nak bercandat</span>
          <input
            type="date"
            className={styles.searchInput}
            value={selected ?? ""}
            min={first ? monthFirstISO(first) : undefined}
            max={last ? monthLastISO(last) : undefined}
            onChange={(e) => onDate(e.target.value)}
            aria-label="Tarikh trip"
          />
        </label>

        <span className={styles.searchDivider} aria-hidden="true" />

        <label className={styles.searchField}>
          <span className={styles.searchLabel}>Berapa orang</span>
          <select
            className={styles.searchInput}
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            aria-label="Bilangan pax"
          >
            {PAX_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o} pax
              </option>
            ))}
          </select>
        </label>

        <a href="#tempah" className={styles.searchBtn}>
          Cari Bot Kosong
        </a>
      </div>

      {outOfSeason && (
        <p className={styles.searchNote} role="status">
          {outOfSeason}
        </p>
      )}
    </>
  );
}
