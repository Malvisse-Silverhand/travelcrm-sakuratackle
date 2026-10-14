/** Money on a booking, for both pricing models (see
 *  supabase/migrations/20261015100000_charter_booking.sql).
 *
 *  `total_amount` is authoritative: a trigger keeps it equal to
 *  pax x price_per_pax for per-pax bookings, and charter bookings store the
 *  boat's daily rate. Never recompute the total from pax and price_per_pax. */
export type BookingMoney = {
  total_amount: number | string;
  deposit_amount: number | string;
  deposit_paid: boolean;
  pay_plan?: "deposit" | "full" | string | null;
};

export const SELECT_MONEY = "total_amount, deposit_amount, deposit_paid, pay_plan";

export function bookingTotal(b: Pick<BookingMoney, "total_amount">): number {
  return Number(b.total_amount);
}

/** What the customer pays before the trip: the deposit, or everything when
 *  they chose to pay in full. `deposit_paid` means this amount arrived. */
export function upfrontAmount(b: Omit<BookingMoney, "deposit_paid">): number {
  return b.pay_plan === "full" ? Number(b.total_amount) : Number(b.deposit_amount);
}

export function amountPaid(b: BookingMoney): number {
  return b.deposit_paid ? upfrontAmount(b) : 0;
}

export function balanceDue(b: BookingMoney): number {
  return Math.max(0, bookingTotal(b) - amountPaid(b));
}

export function payPlanLabel(plan: string | null | undefined): string {
  return plan === "full" ? "Full payment" : "Deposit";
}
