import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingEmail } from "@/lib/email/bookingEmails";

// "Payment received, you're confirmed" with the trip calendar attached. Called
// by the admin screens after marking a booking paid; only sends when the
// booking really is paid, and at most once.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("id, deposit_paid, status")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!booking.deposit_paid || booking.status === "cancelled") {
    return NextResponse.json({ sent: false, reason: "The booking is not marked paid." });
  }

  return NextResponse.json(await sendBookingEmail("paid", id));
}
