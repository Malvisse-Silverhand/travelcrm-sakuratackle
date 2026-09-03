"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DOW_LABELS,
  HOLIDAYS,
  MONTHS,
  SEASON_YEAR,
  formatLongDate,
  isoDate,
  monthLabel,
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
  initialMonthIdx: number;
  initialMonthLabel: string;
  initialNights: NightRow[];
  packageId: string | null;
};

export default function CalendarManager({
  boats,
  initialBoatId,
  initialMonthIdx,
  initialNights,
  packageId,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [boatId, setBoatId] = useState(initialBoatId);
  const [monthIdx, setMonthIdx] = useState(initialMonthIdx);
  const [nights, setNights] = useState<NightRow[]>(initialNights);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialNights[0]?.night_date ?? null);

  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ name: "", phone: "", pax: "6", note: "" });
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showBlock, setShowBlock] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockErr, setBlockErr] = useState<string | null>(null);

  const boat = boats.find((b) => b.id === boatId) ?? boats[0];
  const month = MONTHS[monthIdx];
  const holidays = HOLIDAYS[monthIdx] ?? [];
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
        .gte("night_date", isoDate(monthIdx, 1))
        .lte("night_date", isoDate(monthIdx, month.days))
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
  }, [supabase, boatId, monthIdx, month.days]);

  const cells = useMemo(() => {
    const first = new Date(SEASON_YEAR, month.m, 1).getDay();
    const lead = (first + 6) % 7;
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < lead; i++) out.push({ key: `pad-${i}`, day: null, iso: null });
    for (let d = 1; d <= month.days; d++) out.push({ key: `d-${d}`, day: d, iso: isoDate(monthIdx, d) });
    return out;
  }, [month, monthIdx]);

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
      return `${boat.code} disekat.${selectedRow.blocked_reason ? " " + selectedRow.blocked_reason : ""}`;
    }
    if (selectedRow.pax_held >= selectedRow.capacity) {
      return `${boat.code} penuh ditempah.`;
    }
    if (selectedRow.pax_held > 0) {
      return `${boat.code} ada tempahan. ${selectedRow.pax_held}/${selectedRow.capacity} pax dipegang.`;
    }
    return `${boat.code} kosong. Tiada tempahan.`;
  })();

  const refreshSelectedNight = async () => {
    const { data } = await supabase
      .from("trip_night_status")
      .select("night_date, blocked, blocked_reason, capacity, pax_held, status")
      .eq("boat_id", boatId)
      .eq("night_date", selected!)
      .maybeSingle();
    if (data) {
      setNights((cur) => cur.map((n) => (n.night_date === data.night_date ? (data as NightRow) : n)));
    }
  };

  const submitAssign = async () => {
    if (!boat || !selected || !packageId) return;
    const pax = Number(assignForm.pax);
    if (!assignForm.name.trim() || !assignForm.phone.trim() || !pax || pax < 1) {
      setAssignMsg({ ok: false, text: "Sila isi nama, telefon dan bilangan pax." });
      return;
    }
    setAssignBusy(true);
    setAssignMsg(null);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_package_id: packageId,
      p_boat_id: boat.id,
      p_night_date: selected,
      p_full_name: assignForm.name.trim(),
      p_phone: assignForm.phone.replace(/[^0-9]/g, ""),
      p_email: null,
      p_pax: pax,
      p_note: assignForm.note.trim() || null,
    });
    setAssignBusy(false);
    if (error || !data) {
      setAssignMsg({ ok: false, text: "Gagal simpan tempahan. Cuba lagi." });
      return;
    }
    const ref = Array.isArray(data) ? data[0]?.ref : undefined;
    setAssignMsg({ ok: true, text: `Tempahan disimpan${ref ? ` (${ref})` : ""}. Status: pending.` });
    setAssignForm({ name: "", phone: "", pax: "6", note: "" });
    await refreshSelectedNight();
  };

  const toggleBlock = async () => {
    if (!boat || !selected) return;
    setBlockBusy(true);
    setBlockErr(null);
    const nowBlocked = !!selectedRow?.blocked;
    // RLS lets this silently match zero rows with no error at all — .select()
    // catches that instead of treating a no-op as success.
    const { data, error } = await supabase
      .from("trip_nights")
      .update({
        blocked: !nowBlocked,
        blocked_reason: nowBlocked ? null : blockReason.trim() || "Disekat oleh operator",
      })
      .eq("boat_id", boat.id)
      .eq("night_date", selected)
      .select("id");
    setBlockBusy(false);
    if (error || !data?.length) {
      setBlockErr("Gagal simpan. Cuba lagi.");
      return;
    }
    setShowBlock(false);
    setBlockReason("");
    await refreshSelectedNight();
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
                setShowAssign(false);
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
          <span className={styles.adminMonthLabel}>{monthLabel(monthIdx)}</span>
          <button
            type="button"
            className={styles.monthBtn}
            disabled={monthIdx === MONTHS.length - 1}
            onClick={() => setMonthIdx((i) => Math.min(MONTHS.length - 1, i + 1))}
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
                  setShowAssign(false);
                  setShowBlock(false);
                  setAssignMsg(null);
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
            {selected ? formatLongDate(selected) : "Tiada tarikh"}
          </div>
          <div className={styles.selNightMeta}>{loading ? "Memuatkan..." : selMeta}</div>

          <div className={styles.selNightActions}>
            <button
              type="button"
              className={styles.assignBtn}
              disabled={!selected || !packageId}
              onClick={() => {
                setShowAssign((v) => !v);
                setShowBlock(false);
              }}
            >
              Assign booking
            </button>
            <button
              type="button"
              className={styles.blockBtn}
              disabled={!selected}
              onClick={() => {
                setShowBlock((v) => !v);
                setShowAssign(false);
              }}
            >
              {selectedRow?.blocked ? "Unblock night" : "Block night"}
            </button>
          </div>

          {showAssign && (
            <div className={styles.inlineForm}>
              <input
                className={styles.input}
                placeholder="Nama penuh"
                value={assignForm.name}
                onChange={(e) => setAssignForm({ ...assignForm, name: e.target.value })}
              />
              <input
                className={styles.input}
                placeholder="No. telefon"
                value={assignForm.phone}
                onChange={(e) => setAssignForm({ ...assignForm, phone: e.target.value })}
              />
              <input
                className={styles.input}
                type="number"
                min={1}
                placeholder="Bilangan pax"
                value={assignForm.pax}
                onChange={(e) => setAssignForm({ ...assignForm, pax: e.target.value })}
              />
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Nota (pilihan)"
                value={assignForm.note}
                onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
              />
              <button
                type="button"
                className={styles.assignBtn}
                disabled={assignBusy}
                onClick={submitAssign}
              >
                {assignBusy ? "Menyimpan..." : "Simpan tempahan"}
              </button>
              {assignMsg && (
                <span className={assignMsg.ok ? styles.formOk : styles.formErr}>
                  {assignMsg.text}
                </span>
              )}
            </div>
          )}

          {showBlock && !selectedRow?.blocked && (
            <div className={styles.inlineForm}>
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Sebab (cth: ramalan cuaca buruk)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <button type="button" className={styles.blockBtn} disabled={blockBusy} onClick={toggleBlock}>
                {blockBusy ? "Menyimpan..." : "Sahkan sekat malam ini"}
              </button>
              {blockErr && <span className={styles.formErr}>{blockErr}</span>}
            </div>
          )}

          {showBlock && selectedRow?.blocked && (
            <div className={styles.inlineForm}>
              <span className={styles.formErr}>
                Disekat: {selectedRow.blocked_reason ?? "Tiada sebab dicatat"}
              </span>
              <button type="button" className={styles.blockBtn} disabled={blockBusy} onClick={toggleBlock}>
                {blockBusy ? "Menyimpan..." : "Buka semula (unblock)"}
              </button>
              {blockErr && <span className={styles.formErr}>{blockErr}</span>}
            </div>
          )}
        </div>

        <div className={styles.holidayCard}>
          <span className={styles.kpiLabel}>Cuti umum {monthLabel(monthIdx)}</span>
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
