// Customer journey events: when someone booked, paid and sailed, as dated
// and timed events for the journey calendar. Shared by the page (server)
// and the calendar (client).

export type JourneyType = "booked" | "deposit" | "paid_full" | "departure" | "completed" | "no_show" | "cancelled";

export const JOURNEY: Record<JourneyType, { label: string; icon: string; tone: string }> = {
  booked: { label: "Booked", icon: "inbox", tone: "purple" },
  deposit: { label: "Deposit paid", icon: "card", tone: "gold" },
  paid_full: { label: "Paid in full", icon: "coins", tone: "green" },
  departure: { label: "Departure", icon: "anchor", tone: "teal" },
  completed: { label: "Trip completed", icon: "fish", tone: "green" },
  no_show: { label: "No-show", icon: "undo", tone: "red" },
  cancelled: { label: "Cancelled", icon: "undo", tone: "red" },
};

/** Boats leave Jeti Marang at 16:45 (Harbour HQ's sailing time). */
export const DEPARTURE_TIME = "16:45";

export type JourneyEvent = {
  key: string;
  type: JourneyType;
  bookingId: string;
  ref: string;
  name: string;
  phoneKey: string;
  boat: string;
  /** Local (Malaysia) calendar date and time. */
  date: string;
  time: string;
  amount?: number;
};

const MY = "Asia/Kuala_Lumpur";

export function localDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: MY }).format(d),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: MY, hour: "2-digit", minute: "2-digit" }).format(d),
  };
}

export type JourneyBooking = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  status: string;
  night_date: string;
  created_at: string;
  deposit_paid_at: string | null;
  total_amount: number | string;
  trip_outcome: string | null;
  outcome_at: string | null;
  cancelled_at: string | null;
  boats: { code: string } | null;
};

export type JourneyPayment = { booking_id: string; kind: string; amount: number | string; paid_at: string; voided_at: string | null };

/** Every event of these bookings. Payments are passed only for admins; for
 *  vendors (no money) deposit and full-payment events are left out. */
export function journeyEvents(bookings: JourneyBooking[], payments: JourneyPayment[] | null): JourneyEvent[] {
  const out: JourneyEvent[] = [];
  const payBy = new Map<string, JourneyPayment[]>();
  for (const p of payments ?? []) {
    if (p.voided_at || p.kind === "refund") continue;
    (payBy.get(p.booking_id) ?? payBy.set(p.booking_id, []).get(p.booking_id)!).push(p);
  }
  for (const b of bookings) {
    const phoneKey = b.phone.startsWith("60") ? "0" + b.phone.slice(2) : b.phone;
    const base = { bookingId: b.id, ref: b.ref, name: b.full_name, phoneKey, boat: b.boats?.code ?? "?" };
    const push = (type: JourneyType, iso: string, amount?: number) =>
      out.push({ ...base, key: `${b.id}-${type}`, type, ...localDateTime(iso), amount });

    push("booked", b.created_at);

    if (payments) {
      const list = (payBy.get(b.id) ?? []).sort((x, y) => x.paid_at.localeCompare(y.paid_at));
      let running = 0;
      let fullAt: string | null = null;
      for (const p of list) {
        running += Number(p.amount);
        if (!fullAt && running >= Number(b.total_amount) - 0.005) fullAt = p.paid_at;
      }
      const first = list[0];
      if (first && first.paid_at !== fullAt) push("deposit", first.paid_at, Number(first.amount));
      if (fullAt) push("paid_full", fullAt, Number(b.total_amount));
    }

    if (b.status === "cancelled") {
      if (b.cancelled_at) push("cancelled", b.cancelled_at);
      continue;
    }
    out.push({ ...base, key: `${b.id}-departure`, type: "departure", date: b.night_date, time: DEPARTURE_TIME });
    if (b.trip_outcome === "completed" && b.outcome_at) push("completed", b.outcome_at);
    if (b.trip_outcome === "no_show" && b.outcome_at) push("no_show", b.outcome_at);
  }
  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
