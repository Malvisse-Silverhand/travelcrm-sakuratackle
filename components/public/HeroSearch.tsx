"use client";

import { useState } from "react";
import { useBooking } from "./BookingState";
import {
  MONTHS,
  PAX_OPTIONS,
  SEASON_LAST_DAY,
  isoDate,
  monthLabel,
} from "@/lib/season";
import styles from "@/app/public.module.css";

/** The white control that overlaps the bottom of the hero photo. Choosing a
 *  date here jumps the calendar to that month and selects the night; choosing
 *  a group size re-filters the fleet below. */
export default function HeroSearch({ firstMonthIdx }: { firstMonthIdx: number }) {
  const { pax, setPax, selected, pickDate } = useBooking();
  const [outOfSeason, setOutOfSeason] = useState<string | null>(null);

  // A visitor may not search for a night before the first sellable month.
  const minDate = isoDate(firstMonthIdx, 1);

  const onDate = (iso: string) => {
    if (!iso) return;
    if (pickDate(iso)) {
      setOutOfSeason(null);
      document.getElementById("tempah")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setOutOfSeason(
      `Musim candat berjalan Mac hingga September sahaja. Cuba tarikh antara ${monthLabel(
        firstMonthIdx
      )} dan ${monthLabel(MONTHS.length - 1)}.`
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
            min={minDate}
            max={SEASON_LAST_DAY}
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
