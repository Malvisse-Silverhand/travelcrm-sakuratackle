import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, verifyBookingOwner } from "@/lib/booking/owner";

// Named pax list for the public Pembayaran tab, written to `booking_pax` —
// the same table the operator's Booking Detail screen reads.
//
// Ownership is proved the same way the receipt upload proves it; see
// lib/booking/owner.ts for why a reference alone is not enough.

const MAX_NAME_LENGTH = 80;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { ref?: unknown; phone?: unknown; names?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Permintaan tidak sah.", 400);
  }

  const ref = String(body.ref ?? "").trim();
  const phone = normalisePhone(String(body.phone ?? ""));
  if (!ref || !phone) return fail("Sila isi nombor rujukan dan nombor telefon.", 400);

  if (!Array.isArray(body.names)) return fail("Senarai pax tidak sah.", 400);

  const supabase = createAdminClient();
  const owner = await verifyBookingOwner(supabase, ref, phone);
  if (!owner.ok) return fail(owner.message, owner.status);

  // Blank rows are dropped rather than rejected: the design shows one input
  // per pax and does not require every one to be filled in.
  const names = body.names
    .map((n) => String(n ?? "").trim().slice(0, MAX_NAME_LENGTH))
    .filter(Boolean);

  // The booking's own pax count is the cap, not whatever the client sent, so
  // a tampered request cannot grow the list.
  if (names.length > owner.booking.pax) {
    return fail(`Tempahan ini untuk ${owner.booking.pax} pax sahaja.`, 400);
  }
  if (names.length === 0) return fail("Sila isi sekurang-kurangnya satu nama.", 400);

  // Replace rather than append, so re-submitting the form corrects the list
  // instead of duplicating it.
  const { error: clearError } = await supabase
    .from("booking_pax")
    .delete()
    .eq("booking_id", owner.booking.id);
  if (clearError) return fail("Tidak dapat menyimpan senarai pax sekarang.", 503);

  const { data: inserted, error: insertError } = await supabase
    .from("booking_pax")
    .insert(
      names.map((full_name, i) => ({
        booking_id: owner.booking.id,
        full_name,
        sort_order: i,
      }))
    )
    .select("id");

  if (insertError || !inserted?.length) {
    return fail("Tidak dapat menyimpan senarai pax sekarang.", 503);
  }

  return NextResponse.json({ ok: true, saved: inserted.length });
}
