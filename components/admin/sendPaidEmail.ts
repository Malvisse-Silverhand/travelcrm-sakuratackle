/** Ask the server to email the customer "payment received" with the trip
 *  calendar. Returns a line for the admin, or null when there is nothing to
 *  say (no email on the booking, or email not set up yet). */
export async function sendPaidEmail(bookingId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}/paid-email`, { method: "POST" });
    const j = (await res.json()) as { sent?: boolean };
    return j.sent ? "Payment confirmation emailed to the customer." : null;
  } catch {
    return null;
  }
}
