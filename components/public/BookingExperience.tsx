"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DOW_LABELS,
  HOLIDAYS,
  MONTHS,
  PAX_CHIPS,
  PAX_OPTIONS,
  SEASON_YEAR,
  formatLongDate,
  isoDate,
  monthLabel,
} from "@/lib/season";
import styles from "@/app/booking.module.css";

export type Availability = {
  night_date: string;
  status: "open" | "selling_fast" | "full" | "blocked";
  suggested_boat_id: string | null;
  suggested_boat_code: string | null;
};

type CheckResult = {
  ref: string;
  boat_code: string;
  night_date: string;
  pax: number;
  status: string;
  balance_due: number;
};

type Props = {
  packageId: string;
  bannerSrc: string;
  initialAvailability: Availability[];
};

const STATUS_WORD: Record<string, string> = {
  open: "Available",
  selling_fast: "Selling Fast",
  full: "Full",
  blocked: "Tidak dibuka",
};

/** Maps a booking_status value to the pill styling used in the design. */
function statusPillClass(status: string) {
  if (status === "confirmed") return styles.statusOpen;
  if (status === "cancelled" || status === "weather_hold") return styles.statusFull;
  return styles.statusHold;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  deposit_due: "Deposit due",
  weather_hold: "Weather hold",
  cancelled: "Cancelled",
};

export default function BookingExperience({
  packageId,
  bannerSrc,
  initialAvailability,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [monthIdx, setMonthIdx] = useState(0);
  const [pax, setPax] = useState(10);
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability);
  const [loadingCal, setLoadingCal] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [tab, setTab] = useState<"form" | "check">("form");

  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newRef, setNewRef] = useState<string | null>(null);

  const [checkPhone, setCheckPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checkError, setCheckError] = useState<string | null>(null);

  const month = MONTHS[monthIdx];
  const holidays = HOLIDAYS[monthIdx] ?? [];
  const holidayDays = useMemo(() => holidays.map((h) => h.d), [holidays]);

  const byDate = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const row of availability) map.set(row.night_date, row);
    return map;
  }, [availability]);

  /** Refetch whenever the month or the group size changes. */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingCal(true);
      const from = isoDate(monthIdx, 1);
      const to = isoDate(monthIdx, month.days);
      const { data, error } = await supabase.rpc("get_public_availability", {
        p_from: from,
        p_to: to,
        p_pax: pax,
      });
      if (cancelled) return;
      setAvailability(error || !data ? [] : (data as Availability[]));
      setLoadingCal(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, monthIdx, pax, month.days]);

  /** Keep the selection valid: drop it if that night can no longer take the group. */
  useEffect(() => {
    if (loadingCal) return;
    const stillOk =
      selected &&
      byDate.get(selected) &&
      byDate.get(selected)!.status !== "full" &&
      byDate.get(selected)!.status !== "blocked";
    if (stillOk) return;
    const firstOpen = availability.find(
      (r) => r.status === "open" || r.status === "selling_fast"
    );
    setSelected(firstOpen ? firstOpen.night_date : null);
  }, [availability, byDate, selected, loadingCal]);

  const selectedRow = selected ? byDate.get(selected) : undefined;

  const selectionLabel = selectedRow
    ? `${formatLongDate(selectedRow.night_date)}, ${pax} pax (${
        STATUS_WORD[selectedRow.status] ?? selectedRow.status
      })`
    : "Belum pilih tarikh";

  const cells = useMemo(() => {
    // Monday-first lead padding, matching the design's `(first + 6) % 7`.
    const first = new Date(SEASON_YEAR, month.m, 1).getDay();
    const lead = (first + 6) % 7;
    const out: Array<{ key: string; day: number | null; iso: string | null }> = [];
    for (let i = 0; i < lead; i++) out.push({ key: `pad-${i}`, day: null, iso: null });
    for (let d = 1; d <= month.days; d++) {
      out.push({ key: `d-${d}`, day: d, iso: isoDate(monthIdx, d) });
    }
    return out;
  }, [month, monthIdx]);

  const cellClass = useCallback(
    (iso: string) => {
      if (loadingCal) return `${styles.cell} ${styles.cellLoading}`;
      if (iso === selected) return `${styles.cell} ${styles.cellSelected}`;
      const row = byDate.get(iso);
      if (!row) return `${styles.cell} ${styles.cellLoading}`;
      if (row.status === "open") return `${styles.cell} ${styles.cellOpen}`;
      if (row.status === "selling_fast") return `${styles.cell} ${styles.cellHold}`;
      return `${styles.cell} ${styles.cellFull}`;
    },
    [byDate, selected, loadingCal]
  );

  const submitBooking = async () => {
    setFormError(null);
    setNewRef(null);

    if (!selectedRow || !selectedRow.suggested_boat_id) {
      setFormError("Sila pilih tarikh yang masih ada slot.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Sila isi nama penuh.");
      return;
    }
    if (!/^[0-9+\-\s]{9,}$/.test(form.phone.trim())) {
      setFormError("Sila isi nombor telefon yang sah.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_package_id: packageId,
      p_boat_id: selectedRow.suggested_boat_id,
      p_night_date: selectedRow.night_date,
      p_full_name: form.name.trim(),
      p_phone: form.phone.replace(/[^0-9]/g, ""),
      p_email: form.email.trim() || null,
      p_pax: pax,
      p_note: form.note.trim() || null,
    });
    setSubmitting(false);

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      setFormError(
        "Maaf, tempahan tidak berjaya dihantar. Cuba lagi atau WhatsApp kami terus."
      );
      return;
    }

    const ref = Array.isArray(data) ? data[0].ref : (data as { ref: string }).ref;
    setNewRef(ref);
    setForm({ name: "", phone: "", email: "", note: "" });
  };

  const runCheck = async () => {
    setCheckError(null);
    setChecking(true);
    const { data, error } = await supabase.rpc("check_booking_by_phone", {
      p_phone: checkPhone.replace(/[^0-9]/g, ""),
    });
    setChecking(false);
    setChecked(true);
    if (error) {
      setResults([]);
      setCheckError("Tidak dapat menyemak sekarang. Cuba sebentar lagi.");
      return;
    }
    setResults((data ?? []) as CheckResult[]);
  };

  return (
    <>
      <section id="tempah" className={styles.calSection}>
        <div className={styles.calFrame}>
          <div className={styles.calPanel}>
            <div className={styles.banner}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerSrc}
                alt="Candat Sotong 2027, Marang Terengganu"
                className={styles.bannerImg}
              />
            </div>

            <div className={styles.calHead}>
              <div>
                <h2 className={styles.calTitle}>Ready Untuk Candat?</h2>
                <p className={styles.calSub}>
                  Semak kelendar trip. Satu bot, satu trip semalaman. Tekan tarikh untuk
                  tempah.
                </p>
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <i
                    className={styles.legendDot}
                    style={{ background: "var(--success)" }}
                  />
                  Available
                </span>
                <span className={styles.legendItem}>
                  <i className={styles.legendDot} style={{ background: "var(--gold)" }} />
                  Selling Fast
                </span>
                <span className={styles.legendItem}>
                  <i
                    className={styles.legendDot}
                    style={{ background: "var(--danger-bg)" }}
                  />
                  Full
                </span>
              </div>
            </div>

            <span className={styles.panelLabel}>Berapa orang dalam kumpulan anda?</span>
            <div className={styles.paxRow}>
              {PAX_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPax(c)}
                  className={`${styles.paxChip} ${c === pax ? styles.paxChipActive : ""}`}
                >
                  {c} pax
                </button>
              ))}
            </div>

            <div className={styles.monthNav}>
              <button
                type="button"
                className={styles.monthBtn}
                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                disabled={monthIdx === 0}
                aria-label="Bulan sebelum"
              >
                &#8592;
              </button>
              <span className={styles.monthLabel}>{monthLabel(monthIdx)}</span>
              <button
                type="button"
                className={styles.monthBtn}
                onClick={() => setMonthIdx((i) => Math.min(MONTHS.length - 1, i + 1))}
                disabled={monthIdx === MONTHS.length - 1}
                aria-label="Bulan seterusnya"
              >
                &#8594;
              </button>
            </div>

            <div className={styles.grid}>
              {DOW_LABELS.map((d) => (
                <div key={d} className={styles.dow}>
                  {d}
                </div>
              ))}
              {cells.map((c) => {
                if (!c.day || !c.iso) {
                  return <button key={c.key} className={`${styles.cell} ${styles.cellPad}`} />;
                }
                const row = byDate.get(c.iso);
                const disabled =
                  loadingCal || !row || row.status === "full" || row.status === "blocked";
                const isHoliday = holidayDays.includes(c.day);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={cellClass(c.iso)}
                    disabled={disabled}
                    onClick={() => {
                      setSelected(c.iso);
                      setNewRef(null);
                    }}
                    aria-label={`${c.day} ${monthLabel(monthIdx)}${
                      row ? ` — ${STATUS_WORD[row.status]}` : ""
                    }`}
                  >
                    {c.day}
                    {isHoliday && (
                      <i
                        className={`${styles.holidayDot} ${
                          c.iso === selected ? styles.holidayDotSelected : ""
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className={styles.holidayFooter}>
              <span className={styles.panelLabel}>Cuti umum {monthLabel(monthIdx)}</span>
              {holidays.length > 0 ? (
                <div className={styles.holidayChips}>
                  {holidays.map((h, i) => (
                    <span key={`${h.d}-${i}`} className={styles.holidayChip}>
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
      </section>

      <section className={styles.formSection}>
        <div className={styles.formCard}>
          <div className={styles.tabs}>
            <button
              type="button"
              onClick={() => setTab("form")}
              className={`${styles.tab} ${tab === "form" ? styles.tabActive : ""}`}
            >
              Borang Tempahan
            </button>
            <button
              type="button"
              onClick={() => setTab("check")}
              className={`${styles.tab} ${tab === "check" ? styles.tabActive : ""}`}
            >
              Semak Booking Saya
            </button>
          </div>

          {tab === "form" ? (
            <div>
              <div className={styles.slotBanner}>
                <span className={styles.slotLabel}>Slot dipilih</span>
                <span className={styles.slotValue}>{selectionLabel}</span>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nama penuh</span>
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nama seperti dalam IC"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>No. telefon / WhatsApp</span>
                  <input
                    className={styles.input}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0123456789"
                    inputMode="tel"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Bilangan pax</span>
                  <select
                    className={styles.input}
                    value={pax}
                    onChange={(e) => setPax(Number(e.target.value))}
                  >
                    {PAX_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o} pax
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email (pilihan)</span>
                  <input
                    className={styles.input}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@anda.com"
                    inputMode="email"
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span className={styles.fieldLabel}>Nota atau permintaan khas</span>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Contoh: perlukan jaket keselamatan saiz kanak-kanak"
                  />
                </label>
              </div>

              <button
                type="button"
                className={styles.submit}
                onClick={submitBooking}
                disabled={submitting}
              >
                {submitting ? "Menghantar..." : "Saya Ready Book Trip"}
              </button>
              <p className={styles.submitHelp}>
                Kami akan hubungi anda dalam masa 24 jam via WhatsApp.
              </p>

              {newRef && (
                <div className={styles.successNote}>
                  Tempahan diterima. Rujukan {newRef}.
                </div>
              )}
              {formError && <div className={styles.failNote}>{formError}</div>}
            </div>
          ) : (
            <div>
              <p className={styles.checkLead}>
                Masukkan nombor telefon yang digunakan semasa tempahan untuk semak status
                booking anda.
              </p>
              <div className={styles.checkRow}>
                <input
                  className={styles.checkInput}
                  value={checkPhone}
                  onChange={(e) => {
                    setCheckPhone(e.target.value);
                    setChecked(false);
                  }}
                  placeholder="Nombor telefon (cth: 0123456789)"
                  inputMode="tel"
                />
                <button
                  type="button"
                  className={styles.checkBtn}
                  onClick={runCheck}
                  disabled={checking || !checkPhone.trim()}
                >
                  {checking ? "Menyemak..." : "Semak"}
                </button>
              </div>

              {checkError && <div className={styles.failNote}>{checkError}</div>}

              {checked && !checkError && results.length > 0 &&
                results.map((r) => (
                  <div key={r.ref} className={styles.resultCard}>
                    <div className={styles.resultHead}>
                      <span className={styles.resultRef}>{r.ref}</span>
                      <span
                        className={`${styles.statusPill} ${statusPillClass(r.status)}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    <div className={styles.resultBody}>
                      <div>
                        <span className={styles.resultLabel}>Bot</span>
                        <span className={styles.resultValue}>{r.boat_code}</span>
                      </div>
                      <div>
                        <span className={styles.resultLabel}>Tarikh</span>
                        <span className={styles.resultValue}>
                          {formatLongDate(r.night_date)}
                        </span>
                      </div>
                      <div>
                        <span className={styles.resultLabel}>Pax</span>
                        <span className={styles.resultValue}>{r.pax} orang</span>
                      </div>
                      <div>
                        <span className={styles.resultLabel}>Baki</span>
                        <span className={styles.resultBalance}>
                          RM {Number(r.balance_due).toLocaleString("en-MY")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

              {checked && !checkError && results.length === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>Tiada tempahan untuk nombor itu</p>
                  <p className={styles.emptyBody}>
                    Cuba nombor lain, atau WhatsApp kami dan kami semak manual.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
