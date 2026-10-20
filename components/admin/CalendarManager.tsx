"use client";

import Link from "next/link";
import BlockNightDialog from "./BlockNightDialog";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DOW_LABELS,
  formatLongDate,
  holidaysIn,
  monthFirstISO,
  monthISO,
  monthLabel,
  monthLastISO,
  type SeasonMonth,
} from "@/lib/season";
import styles from "../../app/admin/admin.module.css";

type Boat = { id: string; code: string; skipper_name: string; capacity: number };
type NightRow = {
  night_date: string;
  blocked: boolean;
  blocked_reason: string | null;
  capacity: number;
  pax_held: number;
  status: "open" | "selling_fast" | "full" | "blocked";
};

type Props = {
  boats: Boat[];
  initialBoatId: string;
  /** Every month of the season set in Settings. */
  months: SeasonMonth[];
  initialMonthIdx: number;
  initialNights: NightRow[];
};

export default function CalendarManager({
  boats,
  initialBoatId,
  months,
  initialMonthIdx,
  initialNights,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [boatId, setBoatId] = useState(initialBoatId);
  const [monthIdx, setMonthIdx] = useState(initialMonthIdx);
  const [nights, setNights] = useState<NightRow[]>(initialNights);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialNights[0]?.night_date ?? null);


  const [showBlock, setShowBlock] = useState(false);

  const boat = boats.find((b) => b.id === boatId) ?? boats[0];
  const month = months[monthIdx];
  const holidays = useMemo(() => holidaysIn(month), [month]);
  const holidayDays = useMemo(() => holidays.map((h) => h.d), [holidays]);

  const byDate = useMemo(() => {
    const map = new Map<string, NightRow>();
    for (const n of nights) map.set(n.night_date, n);
    return map;
  }, [nights]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trip_night_status")
        .select("night_date, blocked, blocked_reason, capacity, pax_held, status")
        .eq("boat_id", boatId)
        .gte("night_date", monthFirstISO(month))
        .lte("night_date", monthLastISO(month))
        .order("night_date");
      if (cancelled) return;
      const rows = (data ?? []) as NightRow[];
      setNights(rows);
      setSelected((cur) => (cur && rows.some((r) => r.night_date === cur) ? cur : rows[0]?.night_date ?? null));
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, boatId, month]);

  const cells = useMemo(() => {
    const first = new Date(month.year, month.m, 1).getDay();
    const lead = (first + 6) % 7;
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < lead; i++) out.push({ key: `pad-${i}`, day: null, iso: null });
    for (let d = 1; d <= month.days; d++) out.push({ key: `d-${d}`, day: d, iso: monthISO(month, d) });
    return out;
  }, [month]);

  const cellClass = (iso: string) => {
    if (iso === selected) return `${styles.adminCell} ${styles.adminCellSelected}`;
    const row = byDate.get(iso);
    if (!row) return `${styles.adminCell} ${styles.adminCellLoading}`;
    if (row.blocked) return `${styles.adminCell} ${styles.adminCellFull}`;
    if (row.status === "open") return `${styles.adminCell} ${styles.adminCellOpen}`;
    if (row.status === "selling_fast") return `${styles.adminCell} ${styles.adminCellHold}`;
    return `${styles.adminCell} ${styles.adminCellFull}`;
  };

  const selectedRow = selected ? byDate.get(selected) : undefined;

  const selMeta = (() => {
    if (!boat || !selectedRow) return "";
    if (selectedRow.blocked) {
      return `${boat.code} is blocked.${selectedRow.blocked_reason ? " " + selectedRow.blocked_reason : ""}`;
    }
    if (selectedRow.pax_held >= selectedRow.capacity) {
      return `${boat.code} is fully booked.`;
    }
    if (selectedRow.pax_held > 0) {
      return `${boat.code} has bookings: ${selectedRow.pax_held}/${selectedRow.capacity} pax held.`;
    }
    return `${boat.code} is open. No bookings.`;
  })();

  const refreshSelectedNight = async () => {
    const { data } = await supabase
      .from("trip_night_status")
      .select("night_date, blocked, blocked_reason, capacity, pax_held, status")
      .eq("boat_id", boatId)
      .eq("night_date", selected!)
      .maybeSingle();
    if (data) {
      // A night blocked outside the season is new to this list.
      setNights((cur) =>
        cur.some((n) => n.night_date === data.night_date)
          ? cur.map((n) => (n.night_date === data.night_date ? (data as NightRow) : n))
          : [...cur, data as NightRow]
      );
    }
  };

  return (
    <div className={styles.calGrid}>
      <div className={styles.adminCalPanel}>
        <div className={styles.adminBoatChips}>
          {boats.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${styles.adminBoatChip} ${b.id === boatId ? styles.adminBoatChipActive : ""}`}
              onClick={() => {
                setBoatId(b.id);
                setShowBlock(false);
              }}
            >
              {b.code}
            </button>
          ))}
        </div>

        <div className={styles.adminMonthNav}>
          <button
            type="button"
            className={styles.monthBtn}
            disabled={monthIdx === 0}
            onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
          >
            &#8592;
          </button>
          <span className={styles.adminMonthLabel}>{monthLabel(month)}</span>
          <button
            type="button"
            className={styles.monthBtn}
            disabled={monthIdx === months.length - 1}
            onClick={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))}
          >
            &#8594;
          </button>
        </div>

        <div className={styles.adminGrid}>
          {DOW_LABELS.map((d) => (
            <div key={d} className={styles.adminDow}>
              {d}
            </div>
          ))}
          {cells.map((c) => {
            if (!c.day || !c.iso) {
              return <button key={c.key} className={`${styles.adminCell} ${styles.adminCellPad}`} />;
            }
            const isHoliday = holidayDays.includes(c.day);
            return (
              <button
                key={c.key}
                type="button"
                className={cellClass(c.iso)}
                onClick={() => {
                  setSelected(c.iso);
                  setShowBlock(false);
                }}
              >
                {c.day}
                {isHoliday && <i className={styles.adminHolidayDot} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.calSide}>
        <div className={styles.selNightCard}>
          <span className={styles.kpiLabel}>Selected night</span>
          <div className={styles.selNightLabel}>
            {selected ? formatLongDate(selected) : "No date picked"}
          </div>
          <div className={styles.selNightMeta}>{loading ? "Loading…" : selMeta}</div>

          <div className={styles.selNightActions}>
            <Link
              href={selected ? `/admin/bookings/new?date=${selected}&boat=${boatId}` : "/admin/bookings/new"}
              className={styles.assignBtn}
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              Add booking
            </Link>
            <button
              type="button"
              className={styles.blockBtn}
              disabled={!selected}
              onClick={() => {
                setShowBlock((v) => !v);
              }}
            >
              {selectedRow?.blocked ? "Unblock night" : "Block night"}
            </button>
          </div>

          {showBlock && selected && boat && (
            <BlockNightDialog
              boatId={boat.id}
              boatCode={boat.code}
              night={selected}
              blocked={!!selectedRow?.blocked}
              reason={selectedRow?.blocked_reason}
              onClose={() => {
                setShowBlock(false);
                refreshSelectedNight();
              }}
            />
          )}
        </div>

        <div className={styles.holidayCard}>
          <span className={styles.kpiLabel}>Cuti umum {monthLabel(month)}</span>
          {holidays.length > 0 ? (
            <div className={styles.adminHolidayChips}>
              {holidays.map((h, i) => (
                <span key={`${h.d}-${i}`} className={styles.adminHolidayChip}>
                  <b>{h.d}</b>
                  {h.n}
                </span>
              ))}
            </div>
          ) : (
            <span className={styles.holidayEmpty}>Tiada cuti umum bulan ini.</span>
          )}
        </div>
      </div>
    </div>
  );
}
