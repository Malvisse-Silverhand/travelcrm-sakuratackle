"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/public/book/Icon";
import { formatRM } from "@/lib/date";
import { waTemplate, waToCustomer } from "@/lib/admin/waTemplates";
import styles from "./newBooking.module.css";

export type NewBookingBoat = {
  id: string;
  code: string;
  capacity: number;
  dailyRate: number | null;
  jettyName: string;
};

type Props = {
  boats: NewBookingBoat[];
  today: string;
  initialDate: string;
  initialBoatId: string;
  depositPerBoat: number;
};

type NightState = "free" | "taken" | "blocked";

const SOURCES = [
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { key: "phone", label: "Phone call", icon: "broadcast" },
  { key: "walk_in", label: "Walk-in", icon: "pin" },
  { key: "other", label: "Other", icon: "users" },
] as const;

const PAYMENTS = [
  { key: "deposit_due", label: "Waiting for deposit", hint: "Holds the night until you change it." },
  { key: "deposit_paid", label: "Deposit received", hint: "Confirmed. The balance is due at the jetty." },
  { key: "paid_full", label: "Paid in full", hint: "Confirmed. Nothing left to pay." },
  { key: "pending", label: "Tentative", hint: "Expires like an unpaid website hold." },
] as const;

type Done = { id: string; ref: string; whatsapp: string; emailed: boolean | null };

/** Errors from admin_create_booking, in plain words. */
function errorCopy(message: string): string {
  if (message.includes("night taken")) return "That boat is already booked that night. Pick another boat or date.";
  if (message.includes("night blocked")) return "That night is blocked for this boat. Unblock it in the Slot manager first.";
  if (message.includes("night has passed")) return "That date has passed.";
  if (message.includes("invalid group size")) return "Too many people for this boat.";
  if (message.includes("invalid phone")) return "Check the phone number (9 to 15 digits).";
  if (message.includes("invalid email")) return "Check the email address, or leave it empty.";
  if (message.includes("invalid price")) return "Enter the agreed price in RM.";
  if (message.includes("not allowed")) return "You can only add bookings for your own boats.";
  if (message.includes("package not available")) return "No published package. Publish one in Packages first.";
  return "The booking was not saved. Try again.";
}

/** Key in a booking that did not come through the website. Styled like the
 *  homepage booking card so it reads as the same booking, just staff-side. */
export default function NewBookingForm({ boats, today, initialDate, initialBoatId, depositPerBoat }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(initialDate);
  const [boatId, setBoatId] = useState(initialBoatId || boats[0]?.id || "");
  const [pax, setPax] = useState("8");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number]["key"]>("whatsapp");
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]["key"]>("deposit_due");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [nights, setNights] = useState<Record<string, NightState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const boat = boats.find((b) => b.id === boatId) ?? null;
  const total = Number(price) > 0 ? Number(price) : boat?.dailyRate ?? 0;

  // Which boats are free on the chosen night.
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    supabase
      .from("trip_night_status")
      .select("boat_id, status")
      .eq("night_date", date)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, NightState> = {};
        for (const r of data ?? []) {
          map[r.boat_id] = r.status === "blocked" ? "blocked" : r.status === "full" ? "taken" : "free";
        }
        setNights(map);
      });
    return () => {
      cancelled = true;
    };
  }, [date, supabase]);

  const boatState = (id: string): NightState => nights[id] ?? "free";

  const submit = async () => {
    setError(null);
    if (!date || date < today) return setError("Pick a date from today onwards.");
    if (!boat) return setError("Pick a boat.");
    const n = Number(pax);
    if (!n || n < 1 || n > boat.capacity) return setError(`Group size must be 1 to ${boat.capacity} for ${boat.code}.`);
    if (name.trim().length < 2) return setError("Enter the customer's name.");
    if (phone.replace(/\D/g, "").length < 9) return setError("Enter the customer's phone number.");
    if (!total) return setError("Enter the agreed price in RM.");

    setBusy(true);
    const cleanPhone = phone.replace(/\D/g, "");
    const { data, error: rpcError } = await supabase.rpc("admin_create_booking", {
      p_boat_id: boat.id,
      p_night_date: date,
      p_full_name: name.trim(),
      p_phone: cleanPhone,
      p_email: email.trim() || null,
      p_pax: n,
      p_note: note.trim() || null,
      p_source: source,
      p_payment: payment,
      p_total: Number(price) > 0 ? Number(price) : null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (rpcError || !row?.ref) {
      setBusy(false);
      return setError(errorCopy(rpcError?.message ?? ""));
    }

    const paid = payment === "deposit_paid" || payment === "paid_full";
    const deposit = payment === "paid_full" ? total : Math.min(depositPerBoat, total);
    const waText = waTemplate(paid ? "paid" : "received", {
      ref: row.ref,
      fullName: name.trim(),
      nightDate: date,
      boatCode: boat.code,
      pax: n,
      totalAmount: total,
      balanceDue: paid ? total - deposit : total,
      depositAmount: deposit,
      depositPaid: paid,
    });

    let emailed: boolean | null = null;
    if (email.trim() && sendEmail) {
      try {
        const res = await fetch("/api/booking/confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: row.ref, phone: cleanPhone }),
        });
        const j = await res.json().catch(() => ({}));
        emailed = Boolean(j.sent);
      } catch {
        emailed = false;
      }
    }

    setBusy(false);
    setDone({ id: row.id, ref: row.ref, whatsapp: waToCustomer(cleanPhone, waText), emailed });
  };

  const reset = () => {
    setDone(null);
    setName("");
    setPhone("");
    setEmail("");
    setNote("");
    setPrice("");
    setError(null);
  };

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.doneBox}>
          <Icon name="checkCircle" size={44} className={styles.doneIcon} />
          <h2 className={styles.doneTitle}>Booking {done.ref} saved</h2>
          <p className={styles.doneText}>
            {boat?.code}, {date}, {pax} pax, {formatRM(total)}. It is on the calendar now.
            {done.emailed === true && " Confirmation emailed to the customer."}
            {done.emailed === false && " The confirmation email did not go out; send the WhatsApp message instead."}
          </p>
          <div className={styles.doneActions}>
            <a href={done.whatsapp} target="_blank" rel="noopener noreferrer" className={styles.waBtn}>
              <Icon name="whatsapp" size={18} /> Send WhatsApp confirmation
            </a>
            <Link href={`/admin/bookings/${done.id}`} className={styles.ghostBtn}>
              Open booking
            </Link>
            <button type="button" className={styles.ghostBtn} onClick={reset}>
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.card}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={styles.cardGrid}>
        <fieldset className={styles.col}>
          <legend className={styles.colTitle}>Trip</legend>

          <label className={styles.control} htmlFor="nb-date">
            <Icon name="calendar" size={24} className={styles.controlIcon} />
            <span className={styles.controlText}>
              <span className={styles.controlLabel}>Night of the trip</span>
              <input id="nb-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={styles.controlInput} required />
            </span>
          </label>

          <label className={styles.control} htmlFor="nb-boat">
            <Icon name="anchor" size={24} className={styles.controlIcon} />
            <span className={styles.controlText}>
              <span className={styles.controlLabel}>Boat</span>
              <select id="nb-boat" value={boatId} onChange={(e) => setBoatId(e.target.value)} className={styles.controlInput}>
                {boats.map((b) => {
                  const s = boatState(b.id);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.capacity} pax · {b.jettyName}
                      {s === "taken" ? " · booked" : s === "blocked" ? " · blocked" : ""}
                    </option>
                  );
                })}
              </select>
              {boat && boatState(boat.id) !== "free" && (
                <span className={styles.controlWarn}>
                  {boatState(boat.id) === "taken" ? "Already booked this night." : "Blocked this night."}
                </span>
              )}
            </span>
          </label>

          <div className={styles.pair}>
            <label className={styles.control} htmlFor="nb-pax">
              <Icon name="users" size={24} className={styles.controlIcon} />
              <span className={styles.controlText}>
                <span className={styles.controlLabel}>Group size</span>
                <input id="nb-pax" type="number" min={1} max={boat?.capacity ?? 20} inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value)} className={styles.controlInput} />
              </span>
            </label>
            <label className={styles.control} htmlFor="nb-price">
              <Icon name="card" size={24} className={styles.controlIcon} />
              <span className={styles.controlText}>
                <span className={styles.controlLabel}>Agreed price (RM)</span>
                <input
                  id="nb-price"
                  type="number"
                  min={0}
                  step="10"
                  inputMode="decimal"
                  placeholder={boat?.dailyRate ? String(boat.dailyRate) : "e.g. 1500"}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={styles.controlInput}
                />
              </span>
            </label>
          </div>

          <div className={styles.group}>
            <span className={styles.groupLabel}>Payment so far</span>
            <div className={styles.chips} role="radiogroup" aria-label="Payment so far">
              {PAYMENTS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={payment === p.key}
                  className={`${styles.chip} ${payment === p.key ? styles.chipOn : ""}`}
                  onClick={() => setPayment(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className={styles.groupHint}>
              {PAYMENTS.find((p) => p.key === payment)?.hint} Total {formatRM(total)}
              {payment !== "paid_full" && total ? `, deposit ${formatRM(Math.min(depositPerBoat, total))}` : ""}.
            </span>
          </div>
        </fieldset>

        <fieldset className={styles.col}>
          <legend className={styles.colTitle}>Customer</legend>

          <label className={styles.control} htmlFor="nb-name">
            <Icon name="users" size={24} className={styles.controlIcon} />
            <span className={styles.controlText}>
              <span className={styles.controlLabel}>Name</span>
              <input id="nb-name" value={name} maxLength={120} autoComplete="off" onChange={(e) => setName(e.target.value)} className={styles.controlInput} placeholder="Customer's full name" />
            </span>
          </label>

          <div className={styles.pair}>
            <label className={styles.control} htmlFor="nb-phone">
              <Icon name="whatsapp" size={24} className={styles.controlIcon} />
              <span className={styles.controlText}>
                <span className={styles.controlLabel}>Phone</span>
                <input id="nb-phone" type="tel" inputMode="tel" value={phone} maxLength={20} autoComplete="off" onChange={(e) => setPhone(e.target.value)} className={styles.controlInput} placeholder="0123456789" />
              </span>
            </label>
            <label className={styles.control} htmlFor="nb-email">
              <Icon name="receipt" size={24} className={styles.controlIcon} />
              <span className={styles.controlText}>
                <span className={styles.controlLabel}>Email (optional)</span>
                <input id="nb-email" type="email" value={email} maxLength={254} autoComplete="off" onChange={(e) => setEmail(e.target.value)} className={styles.controlInput} placeholder="for the confirmation" />
              </span>
            </label>
          </div>

          <div className={styles.group}>
            <span className={styles.groupLabel}>Booked through</span>
            <div className={styles.chips} role="radiogroup" aria-label="Booked through">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={source === s.key}
                  className={`${styles.chip} ${source === s.key ? styles.chipOn : ""}`}
                  onClick={() => setSource(s.key)}
                >
                  <Icon name={s.icon} size={16} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.noteField} htmlFor="nb-note">
            <span className={styles.groupLabel}>Note (only staff see it)</span>
            <textarea id="nb-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. regular group from Kuantan, bringing own rods" />
          </label>

          <label className={styles.check}>
            <input type="checkbox" checked={sendEmail && !!email.trim()} disabled={!email.trim()} onChange={(e) => setSendEmail(e.target.checked)} />
            Email the customer the usual confirmation{email.trim() ? "" : " (add an email first)"}
          </label>
        </fieldset>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.submitWrap}>
        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Saving…" : "SAVE BOOKING"}
        </button>
      </div>
    </form>
  );
}
