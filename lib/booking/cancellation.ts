// What cancelling a booking costs, by Mal's terms (/polisi, lib/content/policy.ts):
//   - 7 days or more before the trip: the deposit is refunded.
//   - 4 to 6 days: the deposit is not refunded, but can be moved to another date.
//   - Under 4 days: the deposit is forfeited, but can be moved once.
//   - Paid in full: everything above the deposit is refunded 3 days or more
//     before the trip (and the deposit too at 7 days or more).
// Shared by Manage My Booking (to show the customer before they confirm) and
// the server route that performs the cancellation.

export type CancelQuote = {
  daysBefore: number;
  /** What has been paid so far (0 when nothing is verified yet). */
  paid: number;
  refund: number;
  kept: number;
  /** Customer copy explaining the outcome (bahasa rojak). */
  summary: string;
  /** True when moving the date is the better option for the customer. */
  suggestMove: boolean;
};

export function daysUntil(nightISO: string, todayISO: string): number {
  const [y1, m1, d1] = todayISO.split("-").map(Number);
  const [y2, m2, d2] = nightISO.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function cancelQuote(
  b: { night_date: string; total_amount: number; deposit_amount: number; deposit_paid: boolean; pay_plan: string | null },
  todayISO: string
): CancelQuote {
  const daysBefore = daysUntil(b.night_date, todayISO);
  const total = Number(b.total_amount);
  const deposit = Number(b.deposit_amount);
  const full = b.pay_plan === "full";
  const paid = b.deposit_paid ? (full ? total : deposit) : 0;

  if (paid === 0) {
    return {
      daysBefore,
      paid,
      refund: 0,
      kept: 0,
      summary: "Belum ada bayaran disahkan, jadi tiada caj. Malam ini akan dibuka semula untuk group lain.",
      suggestMove: false,
    };
  }

  let refund = 0;
  if (daysBefore >= 7) refund = paid;
  else if (full && daysBefore >= 3) refund = paid - deposit;

  const kept = paid - refund;
  const rmText = (n: number) => "RM" + n.toLocaleString("en-MY");
  let summary: string;
  if (refund === paid) {
    summary = `Trip anda ${daysBefore} hari lagi, jadi ${rmText(refund)} dipulangkan sepenuhnya.`;
  } else if (refund > 0) {
    summary = `Trip anda ${daysBefore} hari lagi: ${rmText(refund)} dipulangkan, deposit ${rmText(kept)} tidak dipulangkan.`;
  } else if (daysBefore >= 4) {
    summary = `Trip anda ${daysBefore} hari lagi, jadi deposit ${rmText(kept)} tidak dipulangkan. Anda boleh tukar ke tarikh lain tanpa kehilangan deposit.`;
  } else {
    summary = `Trip anda kurang dari 4 hari lagi, jadi bayaran ${rmText(kept)} tidak dipulangkan. Anda masih boleh tukar tarikh sekali jika ada slot.`;
  }
  return { daysBefore, paid, refund, kept, summary, suggestMove: kept > 0 };
}
