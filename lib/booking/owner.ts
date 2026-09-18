import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Proof that the caller owns a booking, used by the public Pembayaran tab.
 *
 *  `bookings` has no anon policy (§5) and never will, so the public payment
 *  endpoints run with the service-role key. That key bypasses RLS, which is
 *  exactly why every one of them must call this first: the booking reference
 *  and the phone number must name the same booking. A reference on its own is
 *  not proof — it is printed on the confirmation screen and follows a
 *  predictable shape — but a reference paired with the number that made the
 *  booking is.
 */
export type OwnedBooking = {
  id: string;
  ref: string;
  pax: number;
  deposit_paid: boolean;
};

export type OwnerCheck =
  | { ok: true; booking: OwnedBooking }
  | { ok: false; status: number; message: string };

/** Digits only, matching what the booking form stores. */
export function normalisePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export async function verifyBookingOwner(
  supabase: SupabaseClient,
  ref: string,
  phone: string
): Promise<OwnerCheck> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, ref, pax, deposit_paid")
    .eq("ref", ref)
    .eq("phone", phone)
    .maybeSingle<OwnedBooking>();

  if (error) {
    return { ok: false, status: 503, message: "Tidak dapat menyemak tempahan sekarang." };
  }

  // One message for both "no such reference" and "phone does not match", so
  // the endpoint cannot be used to discover which references exist.
  if (!data) {
    return {
      ok: false,
      status: 404,
      message: "Rujukan atau nombor telefon tidak sepadan dengan mana-mana tempahan.",
    };
  }

  return { ok: true, booking: data };
}
