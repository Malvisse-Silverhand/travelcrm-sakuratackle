import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, verifyBookingOwner } from "@/lib/booking/owner";
import { sendBookingEmail } from "@/lib/email/bookingEmails";

// The checkout calls this right after create_charter_booking succeeds. The
// reference and phone must belong together (bookings has no anon policy),
// and each booking's confirmation is sent at most once, so this cannot be
// used to spam an address.
export async function POST(request: Request) {
  let body: { ref?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const ref = String(body.ref ?? "").trim();
  const phone = normalisePhone(String(body.phone ?? ""));
  if (!ref || !phone) return NextResponse.json({ error: "Missing reference or phone." }, { status: 400 });

  const owner = await verifyBookingOwner(createAdminClient(), ref, phone);
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const result = await sendBookingEmail("confirmation", owner.booking.id);
  return NextResponse.json(result);
}
