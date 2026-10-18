import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sendBookingEmail } from "@/lib/email/bookingEmails";
import { cancelQuote } from "@/lib/booking/cancellation";
import { allowedActions, type ActionKey } from "@/lib/booking/actions";
import { todayISO } from "@/lib/date";

// Runs one booking action as the signed-in admin. Writes go through the
// caller's own session (RLS "bookings full access for operator"), so the
// activity-log trigger records who did it. Every update asks for the row
// back: an RLS no-op returns no error, only an empty result.

export type ActionInput = {
  action: ActionKey;
  reason?: string;
  refund?: number;
  notify?: boolean;
  nightDate?: string;
  boatId?: string;
  pax?: number;
};

export type ActionResult =
  | { ok: true; message: string; emailed?: boolean | null }
  | { ok: false; error: string; status: number };

const SELECT =
  "id, ref, status, night_date, boat_id, pax, total_amount, deposit_amount, deposit_paid, pay_plan, balance_paid, trip_outcome, refund_amount, refunded_at, email";

const MOVE_ERRORS: Record<string, string> = {
  "night taken": "That boat is already booked that night.",
  "night blocked": "That night is blocked for this boat.",
  "night has passed": "Pick a date from today onwards.",
  "invalid group size": "Too many people for that boat.",
  "boat not available": "That boat is not active.",
  "booking cancelled": "A cancelled booking cannot be moved.",
  "not allowed": "Only admins can move bookings.",
};

export async function runBookingAction(id: string, input: ActionInput, actorId: string): Promise<ActionResult> {
  const db = await createClient();
  const today = todayISO();

  const { data: b } = await db.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  if (!b) return { ok: false, error: "Booking not found.", status: 404 };
  if (!allowedActions(b, today).includes(input.action)) {
    return { ok: false, error: "That action is not available for this booking any more. Reload the page.", status: 409 };
  }

  const now = new Date().toISOString();
  const update = async (fields: Record<string, unknown>): Promise<ActionResult | null> => {
    const { data, error } = await db.from("bookings").update(fields).eq("id", id).select("id");
    return error || !data?.length ? { ok: false, error: "Nothing was saved. Reload and try again.", status: 500 } : null;
  };
  const done = (message: string, emailed: boolean | null = null): ActionResult => ({ ok: true, message, emailed });

  switch (input.action) {
    case "accept":
      return (await update({ status: "deposit_due", accepted_at: now })) ?? done("Accepted. The night is held until you mark the deposit.");

    case "mark_deposit": {
      const fail = await update({ deposit_paid: true, deposit_paid_at: now, status: "confirmed" });
      if (fail) return fail;
      const mail = await sendBookingEmail("paid", id);
      return done("Deposit marked paid. The booking is confirmed.", mail.sent);
    }

    case "undo_deposit":
      return (
        (await update({ deposit_paid: false, deposit_paid_at: null, status: "deposit_due" })) ??
        done("Payment unmarked. The booking is back to deposit due.")
      );

    case "mark_balance":
      return (await update({ balance_paid: true, balance_paid_at: now })) ?? done("Balance marked as collected.");

    case "undo_balance":
      return (await update({ balance_paid: false, balance_paid_at: null })) ?? done("Balance unmarked.");

    case "weather_hold":
      return (await update({ status: "weather_hold" })) ?? done("On weather hold. Move it to a new date when the sea is safe.");

    case "release_hold":
      return (
        (await update({ status: b.deposit_paid ? "confirmed" : "deposit_due" })) ??
        done("Weather hold released. The trip is back on.")
      );

    case "complete":
      return (await update({ trip_outcome: "completed", outcome_at: now })) ?? done("Trip marked completed.");

    case "no_show":
      return (await update({ trip_outcome: "no_show", outcome_at: now })) ?? done("Marked as no-show.");

    case "clear_outcome":
      return (await update({ trip_outcome: null, outcome_at: null })) ?? done("Outcome cleared.");

    case "move": {
      const nightDate = String(input.nightDate ?? "");
      const boatId = String(input.boatId ?? b.boat_id);
      const pax = Math.round(Number(input.pax ?? b.pax));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nightDate)) return { ok: false, error: "Pick the new date.", status: 400 };
      const { error } = await db.rpc("admin_move_booking", {
        p_id: id,
        p_night_date: nightDate,
        p_boat_id: boatId,
        p_pax: pax,
      });
      if (error) {
        const key = Object.keys(MOVE_ERRORS).find((k) => error.message.includes(k));
        return { ok: false, error: key ? MOVE_ERRORS[key] : "The booking was not moved. Try again.", status: 409 };
      }
      const mail = input.notify ? await sendBookingEmail("moved", id) : null;
      return done("Booking moved.", mail ? mail.sent : null);
    }

    case "cancel": {
      const reason = String(input.reason ?? "").trim().slice(0, 500);
      if (reason.length < 3) return { ok: false, error: "Give a short reason.", status: 400 };
      const quote = cancelQuote(b, today);
      const refund = Math.round(Math.min(Math.max(Number(input.refund ?? quote.refund), 0), quote.paid) * 100) / 100;
      const fail = await update({
        status: "cancelled",
        cancel_reason: reason,
        cancelled_at: now,
        cancelled_by: actorId,
        refund_amount: refund,
        refunded_at: null,
      });
      if (fail) return fail;
      const mail = input.notify ? await sendBookingEmail("cancelled", id) : null;
      return done(refund > 0 ? `Cancelled. Refund of RM${refund} is due.` : "Cancelled.", mail ? mail.sent : null);
    }

    case "refund_paid":
      return (await update({ refunded_at: now })) ?? done("Refund recorded as paid.");

    case "resend_email": {
      const kind = b.deposit_paid && b.status === "confirmed" ? "paid" : "confirmation";
      const mail = await sendBookingEmail(kind, id, { force: true });
      return mail.sent
        ? done(kind === "paid" ? "Confirmation with calendar sent again." : "Booking details sent again.", true)
        : { ok: false, error: mail.reason ?? "The email was not sent.", status: 502 };
    }
  }
  return { ok: false, error: "Unknown action.", status: 400 };
}
