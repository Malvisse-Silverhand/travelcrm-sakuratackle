"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate } from "@/lib/season";
import styles from "@/app/booking.module.css";

type CheckResult = {
  ref: string;
  boat_code: string;
  night_date: string;
  pax: number;
  status: string;
  balance_due: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  deposit_due: "Deposit due",
  weather_hold: "Weather hold",
  cancelled: "Cancelled",
};

/** Maps a booking_status value to the pill styling used in the design. */
function statusPillClass(status: string) {
  if (status === "confirmed") return styles.statusOpen;
  if (status === "cancelled" || status === "weather_hold") return styles.statusFull;
  return styles.statusHold;
}

/** "Semak Booking Saya": look up a customer's bookings by the phone number
 *  they booked with. Phase 3's client portal replaces this. */
export default function CheckBooking() {
  const supabase = useMemo(() => createClient(), []);
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setError(null);
    setChecking(true);
    const { data, error } = await supabase.rpc("check_booking_by_phone", {
      p_phone: phone.replace(/[^0-9]/g, ""),
    });
    setChecking(false);
    setChecked(true);
    if (error) {
      setResults([]);
      setError("Tidak dapat menyemak sekarang. Cuba sebentar lagi.");
      return;
    }
    setResults((data ?? []) as CheckResult[]);
  };

  return (
    <div>
      <p className={styles.checkLead}>
        Masukkan nombor telefon yang digunakan semasa tempahan untuk semak status booking
        anda.
      </p>
      <div className={styles.checkRow}>
        <input
          className={styles.checkInput}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setChecked(false);
          }}
          placeholder="Nombor telefon (cth: 0123456789)"
          inputMode="tel"
        />
        <button
          type="button"
          className={styles.checkBtn}
          onClick={runCheck}
          disabled={checking || !phone.trim()}
        >
          {checking ? "Menyemak..." : "Semak"}
        </button>
      </div>

      {error && <div className={styles.failNote}>{error}</div>}

      {checked &&
        !error &&
        results.map((r) => (
          <div key={r.ref} className={styles.resultCard}>
            <div className={styles.resultHead}>
              <span className={styles.resultRef}>{r.ref}</span>
              <span className={`${styles.statusPill} ${statusPillClass(r.status)}`}>
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
                <span className={styles.resultValue}>{formatLongDate(r.night_date)}</span>
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

      {checked && !error && results.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Tiada tempahan untuk nombor itu</p>
          <p className={styles.emptyBody}>
            Cuba nombor lain, atau WhatsApp kami dan kami semak manual.
          </p>
        </div>
      )}
    </div>
  );
}
