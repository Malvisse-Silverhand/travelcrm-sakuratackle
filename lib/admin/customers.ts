// Customers, derived from bookings. There is no customers table yet: a
// customer is everyone who booked with the same phone number (the number is
// what customers book with, and what the operator WhatsApps). Notes and tags
// need a table of their own and come with the phase 4c migrations.

import { normalizePhoneLocal } from "@/lib/phone";
import { amountPaid, bookingTotal } from "@/lib/booking/amounts";

export type CustomerBooking = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: string;
  night_date: string;
  pax: number;
  price_per_pax: number;
  total_amount: number;
  deposit_amount: number;
  pay_plan: string | null;
  deposit_paid: boolean;
  created_at: string;
  boats: { code: string } | null;
};

export type Customer = {
  /** Local-format digits, e.g. 0123456789. Also the profile URL segment. */
  key: string;
  name: string;
  email: string | null;
  /** Bookings that were not cancelled. */
  trips: number;
  cancelled: number;
  lastTrip: string | null;
  nextTrip: string | null;
  /** pax × price over bookings that were not cancelled. */
  value: number;
  depositsPaid: number;
  firstBooked: string;
  /** From customer_notes, when the operator has tagged them. */
  tags?: string[];
  /** Where we know them from: bookings in the system, an import, or both. */
  source?: "online" | "imported" | "both";
  /** Trips from before the system (imported), included in trips and value. */
  pastTrips?: number;
};

export type ImportedCustomer = { phone_key: string; name: string; email: string | null; tags: string[] | null };
export type PastTrip = {
  phone_key: string;
  trip_date: string;
  boat_label: string | null;
  pax: number | null;
  amount: number | string | null;
  note: string | null;
};

/** Add imported customers and their past trips to the customers built from
 *  bookings. Past trips count as trips and value (so Repeat and lifetime
 *  value include history) but never as upcoming. */
export function mergeHistory(list: Customer[], imported: ImportedCustomer[], past: PastTrip[]): Customer[] {
  const byKey = new Map(list.map((c) => [c.key, { ...c, source: "online" as Customer["source"], pastTrips: 0 }]));
  for (const ic of imported) {
    const c = byKey.get(ic.phone_key);
    if (c) {
      c.source = "both";
      c.email = c.email ?? ic.email;
    } else {
      byKey.set(ic.phone_key, {
        key: ic.phone_key,
        name: ic.name,
        email: ic.email,
        trips: 0,
        cancelled: 0,
        lastTrip: null,
        nextTrip: null,
        value: 0,
        depositsPaid: 0,
        firstBooked: "9999-12-31",
        source: "imported",
        pastTrips: 0,
      });
    }
  }
  for (const t of past) {
    const c = byKey.get(t.phone_key);
    if (!c) continue;
    c.trips += 1;
    c.pastTrips = (c.pastTrips ?? 0) + 1;
    c.value += Number(t.amount ?? 0);
    if (!c.lastTrip || t.trip_date > c.lastTrip) c.lastTrip = t.trip_date;
    if (t.trip_date < c.firstBooked.slice(0, 10)) c.firstBooked = t.trip_date;
  }
  return Array.from(byKey.values())
    .map((c) => (c.firstBooked === "9999-12-31" ? { ...c, firstBooked: new Date().toISOString() } : c))
    .sort((a, b) => (b.nextTrip ?? b.lastTrip ?? "").localeCompare(a.nextTrip ?? a.lastTrip ?? ""));
}

/** Tags offered on a customer's profile. */
export const CUSTOMER_TAGS = ["VIP", "Repeat", "Corporate", "Family", "Needs follow-up", "Do not book"];

/** One phone number, however it was typed: "+60 12-345 6789",
 *  "60123456789" and "0123456789" are the same customer. */
export function customerKey(phone: string): string {
  return normalizePhoneLocal(phone);
}

/** Stored forms a key can appear as, for querying bookings.phone. */
export function phoneVariants(key: string): string[] {
  return key.startsWith("0") ? [key, `6${key}`] : [key];
}

export function groupCustomers(rows: CustomerBooking[], today: string): Customer[] {
  const byKey = new Map<string, CustomerBooking[]>();
  for (const r of rows) {
    const k = customerKey(r.phone);
    if (!k) continue;
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }
  return Array.from(byKey, ([key, list]) => summarise(key, list, today)).sort((a, b) =>
    (b.nextTrip ?? b.lastTrip ?? "").localeCompare(a.nextTrip ?? a.lastTrip ?? "")
  );
}

export function summarise(key: string, list: CustomerBooking[], today: string): Customer {
  // Latest booking first: its name and email are the most current.
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const live = sorted.filter((b) => b.status !== "cancelled");
  const past = live.filter((b) => b.night_date < today).map((b) => b.night_date).sort();
  const future = live.filter((b) => b.night_date >= today).map((b) => b.night_date).sort();
  return {
    key,
    name: sorted[0].full_name,
    email: sorted.find((b) => b.email)?.email ?? null,
    trips: live.length,
    cancelled: sorted.length - live.length,
    lastTrip: past[past.length - 1] ?? null,
    nextTrip: future[0] ?? null,
    value: live.reduce((s, b) => s + bookingTotal(b), 0),
    depositsPaid: sorted.reduce((s, b) => s + amountPaid(b), 0),
    firstBooked: sorted[sorted.length - 1].created_at,
  };
}
