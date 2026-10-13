"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { useBooking } from "./BookingState";
import BookingCalendar, { CalendarLegend, STATUS_WORD } from "./BookingCalendar";
import CheckBooking from "./CheckBooking";
import PaymentPanel from "./PaymentPanel";
import {
  PAX_CHIPS,
  formatLongDate,
  holidaysIn,
  monthFirstISO,
  monthLabel,
  monthLastISO,
} from "@/lib/season";
import styles from "@/app/booking.module.css";

export type Availability = {
  night_date: string;
  status: "open" | "selling_fast" | "full" | "blocked";
  suggested_boat_id: string | null;
  suggested_boat_code: string | null;
};

type Props = {
  packageId: string;
  pricePerPax: number;
  depositPerBoat: number;
  /** Group size `initialAvailability` was fetched for, so the first render
   *  knows it already has the data it would otherwise go and ask for. */
  initialPax: number;
  initialAvailability: Availability[];
  /** Extra class for the section, e.g. the homepage's one-screen sizing. */
  className?: string;
  /** The availability read failed (as opposed to: no nights are open). */
  unavailable?: boolean;
  /** For the empty state's WhatsApp link. */
  waHref?: string;
};

/** The three booking steps, then the confirmation. "pay" and "check" sit
 *  outside the steps: they serve customers who have already booked, until
 *  the phase 3 client portal takes them over. */
type View = "date" | "details" | "review" | "done" | "pay" | "check";

const STEPS: Array<{ view: View; label: string }> = [
  { view: "date", label: "Tarikh & pax" },
  { view: "details", label: "Butiran anda" },
  { view: "review", label: "Semak & hantar" },
];

const ORDER: View[] = ["date", "details", "review", "done", "pay", "check"];

const SUBTITLE: Record<View, string> = {
  date: "Pilih saiz group dan malam trip. Satu bot, satu trip semalaman.",
  details: "Siapa ketua kumpulan? Kami hubungi nombor ini untuk sahkan trip.",
  review: "Pastikan semua betul sebelum hantar.",
  done: "Slot anda dah masuk sistem kami.",
  pay: "Dah tempah? Jelaskan deposit dan hantar resit di sini.",
  check: "Semak status tempahan dengan nombor telefon anda.",
};

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

export default function BookingExperience({
  packageId,
  pricePerPax,
  depositPerBoat,
  initialPax,
  initialAvailability,
  className,
  unavailable,
  waHref,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { pax, setPax, selected, setSelected, months, monthIdx, setMonthIdx } = useBooking();

  const [availability, setAvailability] = useState<Availability[]>(initialAvailability);
  const [loadingCal, setLoadingCal] = useState(false);

  const [view, setView] = useState<View>("date");
  // +1 slides the next panel in from the right, -1 from the left.
  const [dir, setDir] = useState(1);
  const sectionRef = useRef<HTMLElement>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newRef, setNewRef] = useState<string | null>(null);
  /** Phone the booking was made with — prefills Pembayaran so the customer
   *  does not retype it straight after booking. */
  const [bookedPhone, setBookedPhone] = useState("");

  // Undefined only when no months are on sale; the empty state below covers it.
  const month = months[monthIdx] as (typeof months)[number] | undefined;
  const holidays = month ? holidaysIn(month) : [];

  const byDate = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const row of availability) map.set(row.night_date, row);
    return map;
  }, [availability]);

  /** Month + pax the availability on screen belongs to. Seeded with what the
   *  server already fetched, so mounting does not immediately re-request the
   *  same rows — that round trip greyed the whole calendar out for a moment
   *  on every page load. */
  const loadedFor = useRef(`0:${initialPax}`);

  /** Refetch whenever the month or the group size changes. */
  useEffect(() => {
    const key = `${monthIdx}:${pax}`;
    if (!month || loadedFor.current === key) return;

    let cancelled = false;
    const load = async () => {
      setLoadingCal(true);
      const { data, error } = await supabase.rpc("get_public_availability", {
        p_from: monthFirstISO(month),
        p_to: monthLastISO(month),
        p_pax: pax,
      });
      if (cancelled) return;
      loadedFor.current = key;
      setAvailability(error || !data ? [] : (data as Availability[]));
      setLoadingCal(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, monthIdx, pax, month]);

  /** Keep the selection valid: drop it if that night can no longer take the
   *  group, and fall back to the first night that can. */
  useEffect(() => {
    if (loadingCal) return;
    const row = selected ? byDate.get(selected) : undefined;
    const stillOk = row && row.status !== "full" && row.status !== "blocked";
    if (stillOk) return;

    // A selection in another month is not stale — the calendar simply is not
    // showing it — so leave it alone rather than stealing the choice back.
    if (selected && !byDate.has(selected)) return;

    const firstOpen = availability.find(
      (r) => r.status === "open" || r.status === "selling_fast"
    );
    setSelected(firstOpen ? firstOpen.night_date : null);
  }, [availability, byDate, selected, loadingCal, setSelected]);

  const selectedRow = selected ? byDate.get(selected) : undefined;
  const canBook = !!selectedRow?.suggested_boat_id && !loadingCal;

  const selectionLabel = selectedRow
    ? `${formatLongDate(selectedRow.night_date)}, ${pax} pax (${
        STATUS_WORD[selectedRow.status] ?? selectedRow.status
      })`
    : "Belum pilih tarikh";

  /** Where "Kembali" returns to from Pembayaran / Semak. */
  const returnTo = useRef<View>("date");

  const go = (next: View) => {
    if (next === view) return;
    if (next === "pay" || next === "check") {
      if (view !== "pay" && view !== "check") returnTo.current = view;
    }
    setDir(ORDER.indexOf(next) >= ORDER.indexOf(view) ? 1 : -1);
    setFormError(null);
    setView(next);
    // On a phone the next panel can start above the fold after a long step;
    // bring the top of the section back rather than leave the reader mid-form.
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) sectionRef.current?.scrollIntoView({ block: "start" });
  };

  const toReview = () => {
    if (!form.name.trim()) {
      setFormError("Sila isi nama penuh.");
      return;
    }
    if (!/^[0-9+\-\s]{9,}$/.test(form.phone.trim())) {
      setFormError("Sila isi nombor telefon yang sah.");
      return;
    }
    go("review");
  };

  const submitBooking = async () => {
    setFormError(null);

    if (!selectedRow || !selectedRow.suggested_boat_id) {
      setFormError("Sila pilih tarikh yang masih ada slot.");
      return;
    }

    const phone = form.phone.replace(/[^0-9]/g, "");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_package_id: packageId,
      p_boat_id: selectedRow.suggested_boat_id,
      p_night_date: selectedRow.night_date,
      p_full_name: form.name.trim(),
      p_phone: phone,
      p_email: form.email.trim() || null,
      p_pax: pax,
      p_note: form.note.trim() || null,
    });
    setSubmitting(false);

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      setFormError(bookingErrorCopy(error?.message));
      return;
    }

    const ref = Array.isArray(data) ? data[0].ref : (data as { ref: string }).ref;
    setNewRef(ref);
    setBookedPhone(phone);
    setForm({ name: "", phone: "", email: "", note: "" });
    go("done");
  };

  const stepIdx = STEPS.findIndex((s) => s.view === view);
  const inSteps = stepIdx >= 0 || view === "done";
  const total = pax * pricePerPax;

  const slotSummary = (
    <div className={styles.slotCard}>
      <span className={styles.panelLabel}>Slot dipilih</span>
      <div className={styles.slotCardValue}>{selectionLabel}</div>
      <div className={styles.slotCardNote}>
        Bertolak selepas Waktu Asar. Pulang 7:00 pagi keesokannya.
      </div>
      {view !== "done" && (
        <button type="button" className={styles.slotChange} onClick={() => go("date")}>
          Tukar tarikh atau pax
        </button>
      )}
    </div>
  );

  const depositCard = (
    <div className={styles.depositCard}>
      <span className={styles.depositKicker}>Deposit</span>
      <div className={styles.depositAmount}>RM {depositPerBoat.toLocaleString("en-MY")}</div>
      <p className={styles.depositNote}>
        Satu bayaran per bot untuk kunci malam tersebut. Baki dijelaskan di jeti sebelum
        bertolak.
      </p>
    </div>
  );

  return (
    // data-hides-wa-float: the floating WhatsApp button covered the form's
    // own buttons on a phone, so it steps aside while booking is on screen.
    <section
      id="tempah"
      ref={sectionRef}
      className={`${styles.calSection} ${className ?? ""}`}
      data-hides-wa-float
    >
      <div className={styles.calFrame}>
        <div className={styles.calPanel}>
          <div className={styles.calHead}>
            <div>
              <h2 className={styles.calTitle}>Ready Untuk Candat?</h2>
              <p className={styles.calSub}>{SUBTITLE[view]}</p>
            </div>
            <div className={styles.flowLinks}>
              <button
                type="button"
                className={`${styles.flowLink} ${view === "pay" ? styles.flowLinkOn : ""}`}
                onClick={() => go("pay")}
              >
                Bayar deposit
              </button>
              <button
                type="button"
                className={`${styles.flowLink} ${view === "check" ? styles.flowLinkOn : ""}`}
                onClick={() => go("check")}
              >
                Semak booking saya
              </button>
            </div>
          </div>

          {inSteps && (
            <ol className={styles.stepper} aria-label="Langkah tempahan">
              {STEPS.map((s, i) => {
                const done = view === "done" || i < stepIdx;
                const active = i === stepIdx;
                return (
                  <li key={s.view} className={styles.stepperItem}>
                    <button
                      type="button"
                      className={`${styles.stepPill} ${active ? styles.stepPillOn : ""} ${
                        done ? styles.stepPillDone : ""
                      }`}
                      disabled={view === "done" || i >= stepIdx}
                      onClick={() => go(s.view)}
                      aria-current={active ? "step" : undefined}
                    >
                      <span className={styles.stepDot} aria-hidden="true">
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={styles.stepLabel}>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <LazyMotion features={domAnimation}>
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <m.div
                  key={view}
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {view === "date" && !month && (
                    <div className={styles.flowCard}>
                      <h3 className={styles.cardTitle}>
                        {unavailable
                          ? "Sistem tempahan sedang diselenggara"
                          : "Tarikh trip belum dibuka"}
                      </h3>
                      <p className={styles.doneBody} style={{ margin: 0, textAlign: "left" }}>
                        {unavailable
                          ? "Kalendar tidak dapat dimuatkan buat masa ini. WhatsApp kami dan kami tempah untuk anda."
                          : "Musim candat seterusnya belum dibuka untuk tempahan. WhatsApp kami untuk tanya tarikh atau masuk senarai menunggu."}
                      </p>
                      {waHref && (
                        <div className={styles.actions}>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.primaryBtn}
                            style={{ textAlign: "center", marginLeft: 0 }}
                          >
                            WhatsApp Kami
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {view === "date" && month && (
                    <div className={styles.dateStep}>
                      <div className={styles.areaPax}>
                        <span className={styles.panelLabel}>
                          Berapa orang dalam kumpulan anda?
                        </span>
                        <div className={styles.paxRow}>
                          {PAX_CHIPS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setPax(c)}
                              aria-pressed={c === pax}
                              className={`${styles.paxChip} ${
                                c === pax ? styles.paxChipActive : ""
                              }`}
                            >
                              {c} pax
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.areaCal}>
                        <BookingCalendar
                          months={months}
                          monthIdx={monthIdx}
                          onMonth={setMonthIdx}
                          byDate={byDate}
                          selected={selected}
                          loading={loadingCal}
                          onPick={(iso) => {
                            setSelected(iso);
                            setNewRef(null);
                          }}
                        />
                        <div className={styles.nextBar}>
                          <div className={styles.nextBarText}>
                            <span className={styles.panelLabel}>Slot dipilih</span>
                            <span className={styles.nextBarValue}>{selectionLabel}</span>
                          </div>
                          <button
                            type="button"
                            className={styles.nextBtn}
                            disabled={!canBook}
                            onClick={() => go("details")}
                          >
                            Teruskan &rarr;
                          </button>
                        </div>
                      </div>

                      <div className={styles.areaSide}>
                        <CalendarLegend />
                        <span className={styles.panelLabel}>
                          Cuti umum {month ? monthLabel(month) : ""}
                        </span>
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
                          <span className={styles.holidayEmpty}>
                            Tiada cuti umum bulan ini.
                          </span>
                        )}
                        <div className={styles.sideDeposit}>{depositCard}</div>
                      </div>
                    </div>
                  )}

                  {view === "details" && (
                    <div className={styles.stepSplit}>
                      <div className={styles.flowCard}>
                        <h3 className={styles.cardTitle}>Butiran ketua kumpulan</h3>
                        <div className={styles.formGrid}>
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>Nama penuh</span>
                            <input
                              className={styles.input}
                              value={form.name}
                              onChange={(e) => setForm({ ...form, name: e.target.value })}
                              placeholder="Nama seperti dalam IC"
                              autoComplete="name"
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
                              autoComplete="tel"
                            />
                          </label>
                          <label className={styles.fieldWide}>
                            <span className={styles.fieldLabel}>Email (pilihan)</span>
                            <input
                              className={styles.input}
                              value={form.email}
                              onChange={(e) => setForm({ ...form, email: e.target.value })}
                              placeholder="email@anda.com"
                              inputMode="email"
                              autoComplete="email"
                            />
                          </label>
                          <label className={styles.fieldWide}>
                            <span className={styles.fieldLabel}>
                              Nota atau permintaan khas
                            </span>
                            <textarea
                              className={styles.textarea}
                              rows={2}
                              value={form.note}
                              onChange={(e) => setForm({ ...form, note: e.target.value })}
                              placeholder="Contoh: perlukan jaket keselamatan saiz kanak-kanak"
                            />
                          </label>
                        </div>
                        {formError && <div className={styles.failNote}>{formError}</div>}
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => go("date")}
                          >
                            &larr; Tarikh
                          </button>
                          <button type="button" className={styles.primaryBtn} onClick={toReview}>
                            Semak tempahan &rarr;
                          </button>
                        </div>
                      </div>
                      <div className={styles.splitSide}>
                        {slotSummary}
                        <div className={styles.sideDeposit}>{depositCard}</div>
                      </div>
                    </div>
                  )}

                  {view === "review" && (
                    <div className={styles.stepSplit}>
                      <div className={styles.flowCard}>
                        <h3 className={styles.cardTitle}>Semak sebelum hantar</h3>
                        <dl className={styles.reviewList}>
                          <ReviewRow
                            label="Malam trip"
                            value={selected ? formatLongDate(selected) : "—"}
                          />
                          <ReviewRow label="Bilangan" value={`${pax} pax`} />
                          <ReviewRow
                            label="Bot"
                            value={selectedRow?.suggested_boat_code ?? "—"}
                          />
                          <ReviewRow label="Nama" value={form.name.trim()} />
                          <ReviewRow label="Telefon" value={form.phone.trim()} />
                          {form.email.trim() && (
                            <ReviewRow label="Email" value={form.email.trim()} />
                          )}
                          {form.note.trim() && (
                            <ReviewRow label="Nota" value={form.note.trim()} />
                          )}
                          <ReviewRow
                            label="Anggaran harga"
                            value={`RM ${total.toLocaleString("en-MY")}`}
                            hint={`${pax} pax × RM${pricePerPax.toLocaleString("en-MY")}`}
                          />
                          <ReviewRow
                            label="Deposit"
                            value={`RM ${depositPerBoat.toLocaleString("en-MY")}`}
                            hint="Dibayar selepas tempahan dihantar"
                            strong
                          />
                        </dl>
                        {formError && <div className={styles.failNote}>{formError}</div>}
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => go("details")}
                          >
                            &larr; Ubah butiran
                          </button>
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={submitBooking}
                            disabled={submitting || !canBook}
                          >
                            {submitting ? "Menghantar..." : "Saya Ready Book Trip"}
                          </button>
                        </div>
                        <p className={styles.submitHelp}>
                          Kami akan hubungi anda dalam masa 24 jam via WhatsApp.
                        </p>
                      </div>
                      <div className={styles.splitSide}>
                        {slotSummary}
                        <div className={styles.sideDeposit}>{depositCard}</div>
                      </div>
                    </div>
                  )}

                  {view === "done" && (
                    <div className={styles.stepSplit}>
                      <div className={`${styles.flowCard} ${styles.doneCard}`}>
                        <span className={styles.doneTick} aria-hidden="true">
                          ✓
                        </span>
                        <h3 className={styles.cardTitle}>Tempahan diterima!</h3>
                        <span className={styles.fieldLabel}>Nombor rujukan</span>
                        <div className={styles.doneRef}>{newRef}</div>
                        <p className={styles.doneBody}>
                          Jelaskan deposit RM {depositPerBoat.toLocaleString("en-MY")} untuk
                          lock slot. Kami akan hubungi anda dalam masa 24 jam via WhatsApp.
                        </p>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => {
                              setNewRef(null);
                              go("date");
                            }}
                          >
                            Tempah malam lain
                          </button>
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => go("pay")}
                          >
                            Bayar deposit sekarang
                          </button>
                        </div>
                      </div>
                      <div className={styles.splitSide}>{slotSummary}</div>
                    </div>
                  )}

                  {(view === "pay" || view === "check") && (
                    <div className={styles.flowCard}>
                      <button
                        type="button"
                        className={styles.backLink}
                        onClick={() => go(returnTo.current)}
                      >
                        &larr; Kembali ke tempahan
                      </button>
                      {view === "pay" ? (
                        <PaymentPanel
                          pricePerPax={pricePerPax}
                          depositPerBoat={depositPerBoat}
                          initialRef={newRef ?? ""}
                          initialPhone={bookedPhone}
                          fallbackPax={pax}
                        />
                      ) : (
                        <CheckBooking />
                      )}
                    </div>
                  )}
                </m.div>
              </AnimatePresence>
            </MotionConfig>
          </LazyMotion>
        </div>
      </div>
    </section>
  );
}

/** Customer copy for the reasons create_public_booking rejects a booking
 *  (supabase/migrations/20261014120000_harden_public_booking.sql). */
function bookingErrorCopy(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("not enough seats") || m.includes("night not on sale")) {
    return "Maaf, malam ini baru sahaja penuh atau ditutup. Pilih tarikh lain.";
  }
  if (m.includes("night has passed") || m.includes("outside the season")) {
    return "Tarikh ini sudah tidak dibuka. Pilih tarikh lain.";
  }
  if (m.includes("invalid name")) return "Sila semak nama penuh.";
  if (m.includes("invalid phone")) return "Sila semak nombor telefon.";
  return "Maaf, tempahan tidak berjaya dihantar. Cuba lagi atau WhatsApp kami terus.";
}

function ReviewRow({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={`${styles.reviewRow} ${strong ? styles.reviewRowStrong : ""}`}>
      <dt className={styles.reviewLabel}>{label}</dt>
      <dd className={styles.reviewValue}>
        {value}
        {hint && <span className={styles.reviewHint}>{hint}</span>}
      </dd>
    </div>
  );
}
