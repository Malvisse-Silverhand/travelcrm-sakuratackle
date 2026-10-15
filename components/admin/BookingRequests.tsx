"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

export type RequestRow = {
  id: string;
  kind: "reschedule" | "cancel";
  new_date: string | null;
  note: string | null;
  refund_amount: number | null;
  status: "open" | "done" | "declined";
  created_at: string;
};

/** What the customer asked for from Manage My Booking. A date change is
 *  applied here (the booking moves to the new night if the boat is still
 *  free); a cancellation already happened, and the card tracks the refund. */
export default function BookingRequests({
  bookingId,
  boatId,
  bookingStatus,
  requests,
}: {
  bookingId: string;
  boatId: string;
  /** A cancelled booking cannot be moved; only Decline is offered. */
  bookingStatus: string;
  requests: RequestRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (requests.length === 0) return null;

  const resolve = async (r: RequestRow, status: "done" | "declined") => {
    const { data: me } = await supabase.auth.getUser();
    return supabase
      .from("booking_requests")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: me.user?.id ?? null })
      .eq("id", r.id)
      .eq("status", "open")
      .select("id");
  };

  const apply = async (r: RequestRow) => {
    if (!r.new_date) return;
    if (!window.confirm(`Move this booking to ${formatLongDate(r.new_date)}?`)) return;
    setBusy(r.id);
    setMsg(null);
    // The boat must still be free that night (not blocked, no paid booking).
    const { data: av } = await supabase.rpc("get_boat_availability", {
      p_from: r.new_date,
      p_to: r.new_date,
      p_boat_id: boatId,
    });
    const night = (av ?? [])[0] as { status: string } | undefined;
    if (!night || night.status === "full") {
      setBusy(null);
      setMsg({ ok: false, text: "That night is no longer free on this boat. Decline and WhatsApp the customer." });
      return;
    }
    const { data: moved, error } = await supabase
      .from("bookings")
      .update({ night_date: r.new_date, updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select("id");
    if (error || !moved?.length) {
      setBusy(null);
      setMsg({ ok: false, text: "The booking was not moved. Reload and try again." });
      return;
    }
    const { data: done } = await resolve(r, "done");
    setBusy(null);
    setMsg(
      done?.length
        ? { ok: true, text: `Moved to ${formatLongDate(r.new_date)}. Let the customer know on WhatsApp.` }
        : { ok: false, text: "Moved, but the request was not marked done. Reload." }
    );
    router.refresh();
  };

  const close = async (r: RequestRow, status: "done" | "declined") => {
    setBusy(r.id);
    setMsg(null);
    const { data } = await resolve(r, status);
    setBusy(null);
    if (!data?.length) setMsg({ ok: false, text: "Not updated. Reload and try again." });
    router.refresh();
  };

  return (
    <div className={styles.detailCard}>
      <span className={styles.detailCardLabel}>Customer requests</span>
      <div className={styles.requestList}>
        {requests.map((r) => (
          <div key={r.id} className={styles.requestItem}>
            <div>
              <b>
                {r.kind === "reschedule"
                  ? `Move to ${formatLongDate(r.new_date!)}`
                  : `Cancelled online${Number(r.refund_amount) > 0 ? `, refund ${formatRM(Number(r.refund_amount))}` : ", no refund due"}`}
              </b>
              <span className={styles.requestMeta}>
                {formatLongDate(r.created_at.slice(0, 10))} · {r.status === "open" ? "Open" : r.status === "done" ? "Done" : "Declined"}
                {r.note ? ` · “${r.note}”` : ""}
              </span>
            </div>
            {r.status === "open" && (
              <div className={styles.requestActions}>
                {r.kind === "reschedule" ? (
                  <>
                    {bookingStatus !== "cancelled" && (
                      <button type="button" className={styles.dtBtn} disabled={busy !== null} onClick={() => apply(r)}>
                        Apply move
                      </button>
                    )}
                    <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} disabled={busy !== null} onClick={() => close(r, "declined")}>
                      Decline
                    </button>
                  </>
                ) : (
                  <button type="button" className={styles.dtBtn} disabled={busy !== null} onClick={() => close(r, "done")}>
                    Refund paid
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <p className={msg.ok ? styles.formOk : styles.formErr}>{msg.text}</p>}
    </div>
  );
}
