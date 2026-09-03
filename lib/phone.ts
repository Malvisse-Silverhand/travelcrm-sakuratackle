/** Shared phone helpers. The app stores phone numbers as local Malaysian
 *  digits (e.g. "0123456789"), matching how `bookings.phone` and
 *  `profiles.phone` are populated and matched — no E.164, no symbols. */

export function isEmailLike(input: string): boolean {
  return input.includes("@");
}

/** "+60123456789" or "60123456789" -> "0123456789". Already-local input
 *  passes through unchanged (after stripping non-digits). */
export function normalizePhoneLocal(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("60") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  return digits;
}
