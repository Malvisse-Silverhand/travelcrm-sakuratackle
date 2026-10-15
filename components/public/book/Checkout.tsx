"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { FleetBoat } from "../home/FleetShowcase";
import ReceiptUpload from "./ReceiptUpload";
import Icon from "./Icon";
import {
  HOLIDAYS_BY_DATE,
  PAX_OPTIONS,
  formatLongDate,
  monthFirstISO,
  monthISO,
  monthKey,
  monthLastISO,
  type SeasonMonth,
} from "@/lib/season";
import { BANK, JETTY } from "@/lib/content/site";
import {
  DOW_EN,
  ITINERARY,
  MONTHS_EN,
  PREPARATION,
  TRIP_TIME,
  WAZE_URL,
  jettyLabel,
  perPax,
  rm,
  type Jetty,
} from "@/lib/content/booking";
import { waBoat, waBooked, waLink } from "@/lib/whatsapp";
import styles from "./book.module.css";

export type BoatNight = {
  boat_id: string;
  night_date: string;
  status: "open" | "held" | "full";
};

type Props = {
  packageId: string;
  boat: FleetBoat;
  jetty: Jetty;
  depositPerBoat: number;
  months: SeasonMonth[];
  initialPax: number;
  initialNights: BoatNight[];
  /** Operator's WhatsApp number. */
  waNumber: string;
};

type Plan = "deposit" | "full";

const STEPS = ["Date & Pax", "Your Details", "Payment", "Done"];

const METHODS = [
  { k: "transfer", label: "Bank Transfer", icon: "transfer", live: true },
  { k: "fpx", label: "FPX", icon: "bank", live: false },
  { k: "card", label: "Debit/Credit Card", icon: "card", live: false },
  { k: "duitnow", label: "DuitNow QR", icon: "qr", live: false },
];

/** Whole-boat charter checkout for one boat. The booking is created on
 *  "Confirm Booking" (create_charter_booking); payment is a bank transfer
 *  with a receipt upload until a payment gateway is connected, so the done
 *  step carries the transfer details and the upload. */
export default function Checkout({
  packageId,
  boat,
  jetty,
  depositPerBoat,
  months,
  initialPax,
  initialNights,
  waNumber,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const name = boat.display_name ?? boat.code;
  const rate = Number(boat.daily_rate);
  const deposit = Math.min(depositPerBoat, rate);

  const [step, setStep] = useState(1);
  const [pax, setPax] = useState(initialPax);
  const [monthIdx, setMonthIdx] = useState(0);
  const [byMonth, setByMonth] = useState<Record<string, BoatNight[]>>(() =>
    months[0] ? { [monthKey(months[0])]: initialNights } : {},
  );
  const [date, setDate] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    note: "",
  });
  const [plan, setPlan] = useState<Plan>("deposit");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{
    ref: string;
    phone: string;
    plan: Plan;
  } | null>(null);

  const month = months[monthIdx] as SeasonMonth | undefined;
  const key = month ? monthKey(month) : "";
  const nights = byMonth[key];
  const loading = !!month && !nights;

  // Fetch a month the first time it is shown (or after a booking clash
  // dropped it from the cache).
  useEffect(() => {
    if (!month || byMonth[key]) return;
    let cancelled = false;
    supabase
      .rpc("get_boat_availability", {
        p_from: monthFirstISO(month),
        p_to: monthLastISO(month),
        p_boat_id: boat.id,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        setByMonth((prev) => ({
          ...prev,
          [key]: error || !data ? [] : (data as BoatNight[]),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, month, key, byMonth, boat.id]);

  const status = useMemo(() => {
    const map = new Map<string, BoatNight["status"]>();
    for (const n of nights ?? []) map.set(n.night_date, n.status);
    return map;
  }, [nights]);

  const paxChoices = PAX_OPTIONS.filter((p) => p <= boat.capacity);
  if (!paxChoices.includes(boat.capacity)) paxChoices.push(boat.capacity);

  const shownPlan = booked?.plan ?? plan;
  const payNow = shownPlan === "full" ? rate : deposit;
  const balance = rate - payNow;
  const dateTxt = date ? formatLongDate(date) : "Not selected";

  const goStep = (n: number) => {
    setErr(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    if (step === 1) {
      if (!date) return setErr("Sila pilih tarikh trip.");
      return goStep(2);
    }
    if (step === 2) {
      if (form.name.trim().length < 2) return setErr("Sila isi nama penuh.");
      if (!/^[0-9+\-\s]{9,}$/.test(form.phone.trim())) {
        return setErr("Sila isi nombor telefon yang sah.");
      }
      if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        return setErr("Sila semak alamat emel.");
      }
      return goStep(3);
    }
    if (step === 3) await submit();
  };

  const submit = async () => {
    if (!date) return goStep(1);
    setErr(null);
    setSubmitting(true);
    const phone = form.phone.replace(/[^0-9]/g, "");
    const { data, error } = await supabase.rpc("create_charter_booking", {
      p_package_id: packageId,
      p_boat_id: boat.id,
      p_night_date: date,
      p_full_name: form.name.trim(),
      p_phone: phone,
      p_email: form.email.trim() || null,
      p_pax: pax,
      p_note: form.note.trim() || null,
      p_pay_plan: plan,
    });
    setSubmitting(false);

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.ref) {
      const m = error?.message ?? "";
      if (m.includes("night taken") || m.includes("night not on sale")) {
        // Someone else got there first: show the month as it is now.
        setByMonth((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        setDate(null);
        setStep(1);
        setErr("Maaf, malam ini baru sahaja ditempah. Sila pilih tarikh lain.");
        return;
      }
      setErr(bookingErrorCopy(m));
      return;
    }
    setBooked({ ref: row.ref as string, phone, plan });
    goStep(4);
  };

  const back = () => {
    if (step === 1) {
      router.push("/#tempah");
      return;
    }
    goStep(step - 1);
  };

  // ---------------------------------------------------------------- calendar
  const cells: ReactNode[] = [];
  if (month) {
    const first = (new Date(month.year, month.m, 1).getDay() + 6) % 7;
    for (let i = 0; i < first; i++)
      cells.push(<span key={`b${i}`} aria-hidden="true" />);
    for (let d = 1; d <= month.days; d++) {
      const iso = monthISO(month, d);
      const st = status.get(iso);
      const holiday = HOLIDAYS_BY_DATE[iso];
      const sel = date === iso;
      // "Selling Fast" (another group booked but has not paid) stays on sale:
      // the night goes to whichever group's payment is confirmed first.
      const bookable = st === "open" || st === "held";
      const cls = sel
        ? styles.daySel
        : st === "open"
          ? styles.dayOpen
          : st === "held"
            ? styles.dayHeld
            : st === "full"
              ? styles.dayFull
              : styles.dayNone;
      const sub = sel
        ? "Selected"
        : st === "open"
          ? "Open"
          : st === "held"
            ? "Selling Fast"
            : st === "full"
              ? "Full"
              : "";
      cells.push(
        <button
          key={iso}
          type="button"
          className={`${styles.day} ${cls}`}
          disabled={!bookable || loading}
          aria-pressed={sel}
          aria-label={`${formatLongDate(iso)}${sub ? `, ${sub}` : ", not on sale"}${holiday ? `, ${holiday}` : ""}`}
          title={holiday}
          onClick={() => {
            setDate(iso);
            setErr(null);
          }}
        >
          <span className={styles.dayNum}>{d}</span>
          <span className={styles.daySub}>{sub}</span>
          {holiday && <span className={styles.dayHol} aria-hidden="true" />}
        </button>,
      );
    }
  }

  // WhatsApp: about this boat until booked, then about the booking itself.
  const waHref = booked
    ? waLink(
        waNumber,
        waBooked({
          ref: booked.ref,
          boat: name,
          date: dateTxt,
          pax,
          plan: booked.plan,
          payNow: rm(payNow),
          total: rm(rate),
        })
      )
    : waLink(waNumber, waBoat({ id: boat.id, name }, pax, date ? dateTxt : null));

  const nav = (placement: string) => (
    <div className={`${styles.navRow} ${placement}`}>
      <button type="button" className={styles.btnGhost} onClick={back}>
        <Icon name="arrowLeft" size={16} />
        {step === 1 ? "Change Boat" : "Back"}
      </button>
      <button
        type="button"
        className={styles.btnPrimary}
        onClick={next}
        disabled={submitting || (step === 1 && loading)}
      >
        {submitting && <span className={styles.spinner} aria-hidden="true" />}
        {step === 3
          ? submitting
            ? "Confirming..."
            : "Confirm Booking"
          : "Continue"}
        {!submitting && <Icon name="arrowRight" size={16} />}
      </button>
    </div>
  );

  return (
    <main className={styles.checkout}>
      <ol className={styles.stepper} aria-label="Booking steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const cur = n === step;
          return (
            <li
              key={label}
              className={styles.stepItem}
              aria-current={cur ? "step" : undefined}
            >
              <span
                className={`${styles.stepDot} ${done ? styles.stepDone : cur ? styles.stepCur : ""}`}
              >
                {done ? "✓" : n}
              </span>
              <span className={cur ? styles.stepLabelCur : styles.stepLabel}>
                {label}
              </span>
              {n < STEPS.length && (
                <span
                  className={`${styles.stepLine} ${done ? styles.stepLineDone : ""}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.checkoutGrid}>
        <div className={styles.checkoutMain}>
          {step === 1 && (
            <section className={styles.panel}>
              <div>
                <h1 className={styles.panelTitle}>Choose a date for {name}</h1>
                <p className={styles.muted}>
                  Bertolak selepas Waktu Asar. Pulang pukul 7:00 pagi
                  keesokannya.
                </p>
              </div>
              <div className={styles.stack8}>
                <span className={styles.fieldLabel}>
                  Group size (max {boat.capacity} pax)
                </span>
                <div className={styles.chips}>
                  {paxChoices.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={p === pax}
                      className={`${styles.chip} ${p === pax ? styles.chipOn : ""}`}
                      onClick={() => setPax(p)}
                    >
                      {p} pax
                    </button>
                  ))}
                </div>
              </div>

              {month ? (
                <div className={styles.calBox}>
                  <div className={styles.calHead}>
                    <button
                      type="button"
                      className={styles.calNav}
                      onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                      disabled={monthIdx === 0}
                      aria-label="Previous month"
                    >
                      <Icon name="caretLeft" size={18} />
                    </button>
                    <span className={styles.calMonth}>
                      {MONTHS_EN[month.m]} {month.year}
                    </span>
                    <button
                      type="button"
                      className={styles.calNav}
                      onClick={() =>
                        setMonthIdx((i) => Math.min(months.length - 1, i + 1))
                      }
                      disabled={monthIdx === months.length - 1}
                      aria-label="Next month"
                    >
                      <Icon name="caretRight" size={18} />
                    </button>
                  </div>
                  <div
                    className={`${styles.calGrid} ${loading ? styles.calLoading : ""}`}
                  >
                    {DOW_EN.map((d) => (
                      <span key={d} className={styles.dow}>
                        {d}
                      </span>
                    ))}
                    {cells}
                  </div>
                  <div className={styles.legend}>
                    <span>
                      <i className={styles.lgOpen} />
                      Available
                    </span>
                    <span>
                      <i className={styles.lgHeld} />
                      Selling Fast
                    </span>
                    <span>
                      <i className={styles.lgFull} />
                      Full
                    </span>
                    <span>
                      <i className={styles.lgHol} />
                      Public holiday
                    </span>
                  </div>
                </div>
              ) : (
                <p className={styles.noteWarn}>
                  Tarikh trip belum dibuka.{" "}
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    WhatsApp kami
                  </a>{" "}
                  untuk tanya tarikh.
                </p>
              )}
              {date && status.get(date) === "held" && (
                <p className={styles.noteWarn}>
                  Ada group lain dah tempah malam ini tapi belum bayar. Bot jadi milik group yang
                  bayaran disahkan dulu, jadi buat bayaran secepat mungkin selepas tempah.
                </p>
              )}
              {date && HOLIDAYS_BY_DATE[date] && (
                <p className={styles.holNote}>
                  {formatLongDate(date)} ialah {HOLIDAYS_BY_DATE[date]}. Jeti
                  lebih sesak, sila sampai lebih awal.
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className={styles.panel}>
              <h1 className={styles.panelTitle}>Your Details</h1>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Full name</span>
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="name"
                    placeholder="Nama seperti dalam IC"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Phone (WhatsApp)</span>
                  <input
                    className={styles.input}
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0123456789"
                  />
                  <span className={styles.fieldHint}>
                    Kapten hubungi nombor ini sehari sebelum trip.
                  </span>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email (optional)</span>
                  <input
                    className={styles.input}
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="email@anda.com"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Remarks (optional)</span>
                  <input
                    className={styles.input}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Contoh: ada budak bawah 12 tahun"
                  />
                </label>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className={styles.panel}>
              <h1 className={styles.panelTitle}>Payment</h1>
              <div className={styles.planGrid}>
                <PlanCard
                  on={plan === "deposit"}
                  icon="lock"
                  title="Deposit only"
                  amount={rm(deposit)}
                  sub={`Lock slot sekarang. Baki ${rm(rate - deposit)} dijelaskan di jeti sebelum bertolak.`}
                  onClick={() => setPlan("deposit")}
                />
                <PlanCard
                  on={plan === "full"}
                  icon="checkCircle"
                  title="Full payment"
                  amount={rm(rate)}
                  sub="Tiada baki di jeti. Terus naik bot."
                  onClick={() => setPlan("full")}
                />
              </div>

              <div className={styles.stack12}>
                <span className={styles.fieldLabel}>Payment method</span>
                <div className={styles.methods}>
                  {METHODS.map((m) => (
                    <button
                      key={m.k}
                      type="button"
                      className={`${styles.method} ${m.live ? styles.methodOn : ""}`}
                      disabled={!m.live}
                      aria-pressed={m.live}
                    >
                      <Icon name={m.icon} size={18} />
                      {m.label}
                      {!m.live && (
                        <span className={styles.soonPill}>Coming soon</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.bankCard}>
                  <BankRow label="Bank" value={BANK.bank} />
                  <BankRow label="Account name" value={BANK.accountName} />
                  <BankRow label="Account no." value={BANK.accountNumber} />
                  <BankRow label="Amount" value={rm(payNow)} />
                </div>
                <p className={styles.muted}>
                  Tekan Confirm Booking dulu untuk dapat nombor rujukan. Guna
                  nombor itu sebagai rujukan pindahan, kemudian muat naik resit.
                  Malam ini ditahan untuk anda sementara kami sahkan bayaran.
                </p>
              </div>
              <span className={styles.secure}>
                <Icon name="lock" size={16} />
                Kami tidak simpan butiran bank atau kad anda.
              </span>
              <p className={styles.terms}>
                Dengan tekan Confirm Booking, anda setuju dengan{" "}
                <Link href="/polisi" target="_blank">
                  Booking Terms &amp; Privacy
                </Link>{" "}
                kami, termasuk polisi pembatalan dan cuaca.
              </p>
            </section>
          )}

          {step === 4 && booked && (
            <>
              <section className={styles.panel}>
                <span className={styles.doneTick}>
                  <Icon name="checkCircle" size={30} />
                </span>
                <h1 className={styles.panelTitle}>
                  Thank you! Your booking is in.
                </h1>
                <p className={styles.muted}>
                  {name} pada {dateTxt} sudah ditahan untuk group anda.
                  Pindahkan {rm(payNow)} ke akaun di bawah dan muat naik resit
                  untuk lock slot. Kami WhatsApp anda dalam masa 24 jam.
                </p>
                <div className={styles.refBox}>
                  <div>
                    <div className={styles.refLabel}>Booking reference</div>
                    <div className={styles.refValue}>{booked.ref}</div>
                  </div>
                  <div>
                    <div className={styles.refLabel}>Pay now</div>
                    <div className={styles.refAmt}>{rm(payNow)}</div>
                  </div>
                  <div>
                    <div className={styles.refLabel}>Balance at jetty</div>
                    <div className={styles.refAmt}>{rm(balance)}</div>
                  </div>
                </div>
                <div className={styles.bankCard}>
                  <BankRow label="Bank" value={BANK.bank} />
                  <BankRow label="Account name" value={BANK.accountName} />
                  <BankRow label="Account no." value={BANK.accountNumber} />
                  <BankRow label="Reference" value={booked.ref} />
                </div>
                <h2 className={styles.subTitle}>Upload Payment Receipt</h2>
                <ReceiptUpload
                  initialRef={booked.ref}
                  initialPhone={booked.phone}
                />
              </section>

              <section className={styles.panel}>
                <div>
                  <span className={styles.eyebrow}>Jetty Guide</span>
                  <h2 className={styles.panelTitle}>{JETTY.title}</h2>
                  <p className={styles.muted}>{JETTY.body}</p>
                </div>
                <div className={styles.jettyRow}>
                  <span className={styles.jettyAddr}>
                    <Icon name="pin" size={18} />
                    {JETTY.address}
                  </span>
                  <a
                    href={JETTY.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btnGhost}
                  >
                    <Icon name="map" size={16} />
                    Google Maps
                  </a>
                  <a
                    href={WAZE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btnGhost}
                  >
                    <Icon name="nav" size={16} />
                    Waze
                  </a>
                </div>
                <ol className={styles.itin}>
                  {ITINERARY.map((it) => (
                    <li key={it.title} className={styles.itinItem}>
                      <span className={styles.itinTime}>{it.time}</span>
                      <span>
                        <span className={styles.itinTitle}>{it.title}</span>
                        <span className={styles.itinBody}>{it.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className={styles.prep}>
                  <div className={styles.prepTitle}>Before You Sail</div>
                  <p>{PREPARATION}</p>
                </div>
                <p className={styles.terms}>
                  Cuaca tak elok? Kapten batalkan demi keselamatan dan anda boleh tukar tarikh atau
                  dapat bayaran balik penuh. Baca{" "}
                  <Link href="/polisi#cuaca" target="_blank">
                    polisi cuaca &amp; pembatalan
                  </Link>
                  .
                </p>
                <div className={styles.actionsRow}>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.btnWa}
                  >
                    <Icon name="whatsapp" size={18} />
                    WhatsApp Us
                  </a>
                  <Link href="/" className={styles.btnGhost}>
                    Back to Home
                  </Link>
                </div>
              </section>
            </>
          )}

          {err && (
            <p role="alert" className={styles.noteErr}>
              {err}
            </p>
          )}

          {step < 4 && nav(styles.navMain)}
        </div>

        <div className={styles.side}>
          <aside className={styles.summary} aria-label="Booking summary">
            <div
              role="img"
              aria-label={`Foto bot ${name}`}
              className={styles.summaryPhoto}
              style={
                boat.photo_url
                  ? { backgroundImage: `url("${boat.photo_url}")` }
                  : undefined
              }
            />
            <div className={styles.summaryBody}>
              <div>
                {boat.kind && (
                  <span className={styles.kindBadge}>{boat.kind}</span>
                )}
                <h2 className={styles.summaryName}>{name}</h2>
                <span className={styles.boatLoc}>
                  <Icon name="pin" size={15} />
                  {jettyLabel(jetty)}
                </span>
              </div>
              <div className={styles.summaryRows}>
                <SumRow icon="calendar" label="Date" value={dateTxt} />
                <SumRow icon="users" label="Group" value={`${pax} pax`} />
                <SumRow icon="clock" label="Time" value={TRIP_TIME} />
              </div>
              <div className={styles.summaryMoney}>
                <div>
                  <span>Boat charter (per night)</span>
                  <span>{rm(rate)}</span>
                </div>
                <div>
                  <span>Pay now</span>
                  <b>{rm(payNow)}</b>
                </div>
                <div>
                  <span>Balance at jetty</span>
                  <span>{rm(balance)}</span>
                </div>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span className={styles.summaryTotalValue}>{rm(rate)}</span>
              </div>
              <span className={styles.summaryPerPax}>{perPax(rate, pax)} untuk {pax} pax</span>
            </div>
          </aside>
          {/* On a wide screen the step's buttons sit under the summary, so the
            whole step fits one screen; narrower, they follow the step. */}
          {step < 4 && nav(styles.navSide)}
        </div>
      </div>
    </main>
  );
}

/** Customer copy for the reasons create_charter_booking rejects a booking
 *  (supabase/migrations/20261015100000_charter_booking.sql). */
function bookingErrorCopy(m: string): string {
  if (m.includes("night has passed") || m.includes("outside the season")) {
    return "Tarikh ini sudah tidak dibuka. Pilih tarikh lain.";
  }
  if (m.includes("invalid name")) return "Sila semak nama penuh.";
  if (m.includes("invalid phone")) return "Sila semak nombor telefon.";
  if (m.includes("invalid group size"))
    return "Saiz group melebihi kapasiti bot ini.";
  if (m.includes("boat not available"))
    return "Bot ini tidak lagi dibuka untuk tempahan. Pilih bot lain.";
  return "Maaf, tempahan tidak berjaya dihantar. Cuba lagi atau WhatsApp kami terus.";
}

function PlanCard({
  on,
  icon,
  title,
  amount,
  sub,
  onClick,
}: {
  on: boolean;
  icon: string;
  title: string;
  amount: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.plan} ${on ? styles.planOn : ""}`}
      aria-pressed={on}
      onClick={onClick}
    >
      <Icon name={icon} size={22} className={styles.planIcon} />
      <span className={styles.planText}>
        <span className={styles.planTitle}>{title}</span>
        <span className={styles.planAmt}>{amount}</span>
        <span className={styles.planSub}>{sub}</span>
      </span>
    </button>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={styles.bankLabel}>{label}</span>
      <b className={styles.bankValue}>{value}</b>
    </div>
  );
}

function SumRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className={styles.sumRow}>
      <span className={styles.sumLabel}>
        <Icon name={icon} size={16} />
        {label}
      </span>
      <b className={styles.sumValue}>{value}</b>
    </div>
  );
}
