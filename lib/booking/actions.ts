// What staff can do with a booking next. One table for the admin screens and
// the action route (app/api/admin/bookings/[id]/action), so a button is shown
// exactly when the server will accept it.

import { balanceDue as balanceDueOf, upfrontAmount } from "@/lib/booking/amounts";

export type ActionKey =
  | "accept"
  | "mark_deposit"
  | "undo_deposit"
  | "mark_balance"
  | "undo_balance"
  | "weather_hold"
  | "release_hold"
  | "move"
  | "complete"
  | "no_show"
  | "clear_outcome"
  | "cancel"
  | "refund_paid"
  | "resend_email";

/** The fields of a booking the rules read. */
export type ActionState = {
  status: string;
  night_date: string;
  total_amount: number | string;
  deposit_amount: number | string;
  deposit_paid: boolean;
  pay_plan: string | null;
  balance_paid?: boolean | null;
  trip_outcome?: string | null;
  refund_amount?: number | string | null;
  refunded_at?: string | null;
  email?: string | null;
};

export const ACTION_LABEL: Record<ActionKey, string> = {
  accept: "Accept",
  mark_deposit: "Mark deposit paid",
  undo_deposit: "Undo payment",
  mark_balance: "Balance collected",
  undo_balance: "Undo balance",
  weather_hold: "Weather hold",
  release_hold: "Release weather hold",
  move: "Move date / boat",
  complete: "Mark completed",
  no_show: "No-show",
  clear_outcome: "Clear outcome",
  cancel: "Cancel booking",
  refund_paid: "Refund paid",
  resend_email: "Resend email",
};

/** One line under each action in menus. */
export const ACTION_HINT: Partial<Record<ActionKey, string>> = {
  accept: "Hold the night without expiry while you wait for the deposit",
  mark_deposit: "Confirms the booking and emails the customer",
  mark_balance: "The rest was paid at the jetty",
  weather_hold: "Unsafe sea: keep the booking, pick a new date later",
  move: "Change the night, boat or group size",
  complete: "The trip went ahead",
  no_show: "The group did not turn up",
  cancel: "With reason and refund",
  refund_paid: "The refund has gone back to the customer",
  resend_email: "Sends the latest confirmation again",
};

/** Actions that change the booking for good, shown in red. */
export const DANGER: ActionKey[] = ["cancel", "no_show"];

/** WhatsApp template keys (lib/admin/waTemplates.ts) by situation. */
export type WaKey = "received" | "payment" | "paid" | "reminder" | "weather" | "review" | "general";

export function jettyBalance(b: ActionState): number {
  if (b.balance_paid) return 0;
  return balanceDueOf(b);
}

export function refundOwed(b: ActionState): number {
  return b.status === "cancelled" && !b.refunded_at ? Number(b.refund_amount ?? 0) : 0;
}

/** Every action allowed now, in menu order. */
export function allowedActions(b: ActionState, today: string): ActionKey[] {
  const past = b.night_date < today;
  const out: ActionKey[] = [];
  const add = (k: ActionKey, when = true) => when && out.push(k);

  switch (b.status) {
    case "pending":
      add("accept", !past);
      add("mark_deposit");
      add("move", !past);
      add("resend_email", !!b.email);
      add("cancel");
      break;
    case "deposit_due":
      add("mark_deposit");
      add("move", !past);
      add("resend_email", !!b.email);
      add("cancel");
      break;
    case "confirmed":
      if (past) {
        add("complete", !b.trip_outcome);
        add("no_show", !b.trip_outcome);
        add("clear_outcome", !!b.trip_outcome);
      }
      add("mark_balance", !b.balance_paid && jettyBalance(b) > 0);
      add("undo_balance", !!b.balance_paid);
      add("weather_hold", !past);
      add("move", !past);
      add("resend_email", !!b.email);
      add("undo_deposit", b.deposit_paid && !b.balance_paid && !b.trip_outcome);
      add("cancel", !b.trip_outcome);
      break;
    case "weather_hold":
      add("move");
      add("release_hold", !past);
      add("cancel");
      break;
    case "cancelled":
      add("refund_paid", refundOwed(b) > 0);
      break;
  }
  return out;
}

export type Primary = { kind: "action"; key: ActionKey } | { kind: "wa"; template: WaKey; label: string } | null;

/** The one button that moves this booking forward. */
export function primaryAction(b: ActionState, today: string): Primary {
  const past = b.night_date < today;
  const allowed = allowedActions(b, today);
  const pick = (k: ActionKey): Primary => (allowed.includes(k) ? { kind: "action", key: k } : null);

  switch (b.status) {
    case "pending":
      return pick(past ? "cancel" : "accept");
    case "deposit_due":
      return pick("mark_deposit");
    case "confirmed":
      if (past && !b.trip_outcome) return pick("complete");
      if (past && allowed.includes("mark_balance")) return pick("mark_balance");
      if (past) return { kind: "wa", template: "review", label: "Ask for review" };
      return { kind: "wa", template: "reminder", label: "Send reminder" };
    case "weather_hold":
      return pick("move");
    case "cancelled":
      return pick("refund_paid");
  }
  return null;
}

/** The WhatsApp message that fits the booking's situation. */
export function waTemplateFor(b: ActionState, today: string): WaKey {
  const past = b.night_date < today;
  if (b.status === "pending") return "received";
  if (b.status === "deposit_due") return "payment";
  if (b.status === "weather_hold") return "weather";
  if (b.status === "confirmed") return past ? "review" : "reminder";
  return "general";
}

/** Short payment line for lists: "RM250 paid · RM1,250 at jetty". */
export function paymentSummary(b: ActionState, rm: (n: number) => string): { text: string; tone: "ok" | "warn" | "due" | "muted" } {
  if (b.status === "cancelled") {
    const owed = refundOwed(b);
    if (owed > 0) return { text: `Refund ${rm(owed)} due`, tone: "due" };
    if (b.refunded_at) return { text: `Refunded ${rm(Number(b.refund_amount ?? 0))}`, tone: "muted" };
    return { text: "—", tone: "muted" };
  }
  if (!b.deposit_paid) return { text: `Unpaid · ${rm(upfrontAmount(b))} due`, tone: "warn" };
  const bal = jettyBalance(b);
  if (bal > 0) return { text: `${rm(upfrontAmount(b))} paid · ${rm(bal)} at jetty`, tone: "ok" };
  return { text: "Paid in full", tone: "ok" };
}
