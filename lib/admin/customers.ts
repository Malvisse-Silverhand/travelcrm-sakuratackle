// Customers, derived from bookings. There is no customers table yet: a
// customer is everyone who booked with the same phone number (the number is
// what customers book with, and what the operator WhatsApps). Notes and tags
// need a table of their own and come with the phase 4c migrations.

import { normalizePhoneLocal } from "@/lib/phone";

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
  deposit_amount: number;
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
};

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
    value: live.reduce((s, b) => s + b.pax * Number(b.price_per_pax), 0),
    depositsPaid: sorted.reduce((s, b) => s + (b.deposit_paid ? Number(b.deposit_amount) : 0), 0),
    firstBooked: sorted[sorted.length - 1].created_at,
  };
}
