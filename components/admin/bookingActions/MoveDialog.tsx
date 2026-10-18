"use client";

import { useState } from "react";
import { formatLongDate } from "@/lib/season";
import { postAction, type ActionBooking } from "./BookingActions";
import styles from "./bookingActions.module.css";

export type MoveBoat = { id: string; code: string; capacity: number };

type Props = {
  booking: ActionBooking;
  boats: MoveBoat[];
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
};

/** Move a booking to another night, boat or group size. The database
 *  refuses a night that is already taken or blocked. */
export default function MoveDialog({ booking: b, boats, today, onClose, onDone }: Props) {
  const [date, setDate] = useState(b.night_date >= today ? b.night_date : today);
  const [boatId, setBoatId] = useState(b.boat_id);
  const [pax, setPax] = useState(String(b.pax));
  const [notify, setNotify] = useState(!!b.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boat = boats.find((x) => x.id === boatId);
  const unchanged = date === b.night_date && boatId === b.boat_id && Number(pax) === b.pax;

  const submit = async () => {
    setError(null);
    if (!date || date < today) return setError("Pick a date from today onwards.");
    if (boat && (Number(pax) < 1 || Number(pax) > boat.capacity)) {
      return setError(`Group size must be 1 to ${boat.capacity} for ${boat.code}.`);
    }
    setBusy(true);
    const r = await postAction(b.id, { action: "move", nightDate: date, boatId, pax: Number(pax), notify });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const mail = r.emailed === true ? " New date emailed with a calendar file." : r.emailed === false ? " The email did not go out." : "";
    onDone(`${r.message} Now ${formatLongDate(date)}.${mail}`);
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`move-${b.id}`}>
        <h2 id={`move-${b.id}`}>Move {b.ref}</h2>
        <p>
          Now: {b.boat_code}, {formatLongDate(b.night_date)}, {b.pax} pax. The price and payments stay with the booking.
        </p>
        <div className={styles.pair}>
          <label className={styles.field} htmlFor={`move-date-${b.id}`}>
            New night
            <input id={`move-date-${b.id}`} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className={styles.field} htmlFor={`move-pax-${b.id}`}>
            Group size
            <input
              id={`move-pax-${b.id}`}
              type="number"
              min={1}
              max={boat?.capacity ?? 20}
              inputMode="numeric"
              value={pax}
              onChange={(e) => setPax(e.target.value)}
            />
          </label>
        </div>
        <label className={styles.field} htmlFor={`move-boat-${b.id}`}>
          Boat
          <select id={`move-boat-${b.id}`} value={boatId} onChange={(e) => setBoatId(e.target.value)}>
            {boats.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} · {x.capacity} pax
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={notify && !!b.email} disabled={!b.email} onChange={(e) => setNotify(e.target.checked)} />
          {b.email ? "Email the customer the new date" : "No email on this booking; WhatsApp them after"}
        </label>
        {error && <p className={styles.err}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={onClose}>
            Close
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || unchanged} onClick={submit}>
            {busy ? "Moving…" : "Move booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
