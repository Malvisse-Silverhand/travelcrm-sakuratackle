"use client";

import { useState } from "react";
import { cancelQuote } from "@/lib/booking/cancellation";
import { formatRM } from "@/lib/date";
import { formatLongDate } from "@/lib/season";
import { waToCustomer } from "@/lib/admin/waTemplates";
import { postAction, type ActionBooking } from "./BookingActions";
import styles from "./bookingActions.module.css";

const REASONS = ["Customer asked", "Weather", "No payment", "Boat problem", "Duplicate booking"];

type Props = {
  booking: ActionBooking;
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
};

/** Cancel with a reason and a refund suggested by the booking terms
 *  (lib/booking/cancellation.ts), then hand the admin a WhatsApp message. */
export default function CancelDialog({ booking: b, today, onClose, onDone }: Props) {
  const quote = cancelQuote(
    {
      night_date: b.night_date,
      total_amount: Number(b.total_amount),
      deposit_amount: Number(b.deposit_amount),
      deposit_paid: b.deposit_paid,
      pay_plan: b.pay_plan,
    },
    today
  );
  const weatherRefund = b.status === "weather_hold" ? quote.paid : quote.refund;
  const [preset, setPreset] = useState(b.status === "weather_hold" ? "Weather" : "");
  const [detail, setDetail] = useState("");
  const [refund, setRefund] = useState(String(weatherRefund));
  const [notify, setNotify] = useState(!!b.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reason = [preset, detail.trim()].filter(Boolean).join(": ");
  const refundNum = Math.max(0, Math.min(Number(refund) || 0, quote.paid));

  const submit = async () => {
    setError(null);
    if (reason.length < 3) return setError("Pick or write a reason.");
    setBusy(true);
    const r = await postAction(b.id, { action: "cancel", reason, refund: refundNum, notify });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const mail = r.emailed === true ? " Cancellation emailed." : r.emailed === false ? " The email did not go out." : "";
    setDone(r.message + mail);
    onDone(r.message + mail);
  };

  const first = b.full_name.split(" ")[0];
  const waText = [
    `Salam ${first}, tempahan ${b.ref} (${b.boat_code}, ${formatLongDate(b.night_date)}) telah dibatalkan.`,
    reason ? `Sebab: ${reason}.` : "",
    refundNum > 0
      ? `Kami akan pulangkan ${formatRM(refundNum)}. Boleh hantar nombor akaun bank untuk pemulangan?`
      : quote.paid > 0
        ? "Ikut terma tempahan, tiada pemulangan untuk pembatalan ini."
        : "",
    "Nak pilih tarikh lain? Kami sedia bantu.",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`cancel-${b.id}`}>
        <h2 id={`cancel-${b.id}`}>Cancel {b.ref}</h2>
        {done ? (
          <>
            <p>{done}</p>
            <p>Let {first} know on WhatsApp:</p>
            <div className={styles.quote} style={{ whiteSpace: "pre-wrap" }}>
              {waText}
            </div>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
                Close
              </button>
              <a href={waToCustomer(b.phone, waText)} target="_blank" rel="noopener noreferrer" className={`${styles.btn} ${styles.btnWa}`}>
                Send on WhatsApp
              </a>
            </div>
          </>
        ) : (
          <>
            <p>
              {b.full_name} · {b.boat_code} · {formatLongDate(b.night_date)} · {quote.daysBefore} days before the trip.
            </p>
            <div className={styles.field}>
              Reason
              <div className={styles.chips}>
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.chip} ${preset === r ? styles.chipOn : ""}`}
                    onClick={() => setPreset(preset === r ? "" : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                id={`cancel-detail-${b.id}`}
                value={detail}
                maxLength={300}
                placeholder={preset ? "Add detail (optional)" : "Or write the reason"}
                onChange={(e) => setDetail(e.target.value)}
              />
            </div>

            <div className={styles.quote}>
              Paid so far {formatRM(quote.paid)}. By the booking terms the refund is{" "}
              <b>{formatRM(b.status === "weather_hold" ? quote.paid : quote.refund)}</b>
              {b.status === "weather_hold" ? " (weather: full refund)." : "."}
            </div>

            {quote.paid > 0 && (
              <label className={styles.field} htmlFor={`cancel-refund-${b.id}`}>
                Refund to pay back (RM)
                <input
                  id={`cancel-refund-${b.id}`}
                  type="number"
                  min={0}
                  max={quote.paid}
                  step="10"
                  inputMode="decimal"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                />
              </label>
            )}

            <label className={styles.check}>
              <input type="checkbox" checked={notify && !!b.email} disabled={!b.email} onChange={(e) => setNotify(e.target.checked)} />
              {b.email ? "Email the customer the cancellation" : "No email on this booking; use WhatsApp after"}
            </label>

            {error && <p className={styles.err}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={onClose}>
                Keep booking
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={submit}>
                {busy ? "Cancelling…" : refundNum > 0 ? `Cancel, refund ${formatRM(refundNum)}` : "Cancel booking"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
