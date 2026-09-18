import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, verifyBookingOwner } from "@/lib/booking/owner";

// Deposit receipt upload for the public Pembayaran tab.
//
// The `receipts` bucket stays operator-only (see 20260903152243) and
// `bookings` still has no anon policy, per §5. Instead the customer posts the
// file here and the route proves ownership — see lib/booking/owner.ts —
// before touching the service-role key.
//
// Deliberately narrow: one receipt per booking, replaceable while the deposit
// is still unverified, and refused once the operator has marked it paid.

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Permintaan tidak sah.", 400);
  }

  const ref = String(form.get("ref") ?? "").trim();
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  const file = form.get("file");

  if (!ref || !phone) return fail("Sila isi nombor rujukan dan nombor telefon.", 400);
  if (!(file instanceof File)) return fail("Sila pilih fail resit.", 400);

  // Checked before the database round-trip so an oversized upload is rejected
  // on shape alone, and re-checked against the real bytes, not a claimed size.
  const ext = ALLOWED.get(file.type);
  if (!ext) return fail("Hanya fail JPG atau PNG dibenarkan.", 415);
  if (file.size === 0) return fail("Fail resit kosong.", 400);
  if (file.size > MAX_BYTES) return fail("Saiz fail melebihi 5MB.", 413);

  const supabase = createAdminClient();
  const owner = await verifyBookingOwner(supabase, ref, phone);
  if (!owner.ok) return fail(owner.message, owner.status);

  if (owner.booking.deposit_paid) {
    return fail("Deposit tempahan ini sudah disahkan. Hubungi kami jika perlu ubah.", 409);
  }

  // Path is derived from the booking id and the verified content type, never
  // from the uploaded filename, so a crafted name cannot escape the folder.
  // Same `<booking id>/<file>` layout the operator console uploads into, so
  // its signed-URL viewer resolves these unchanged.
  const path = `${owner.booking.id}/deposit.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return fail("Muat naik gagal. Cuba lagi sebentar.", 502);

  // Stores the path, not a URL: the bucket is private, so the operator console
  // signs it at view time.
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ receipt_url: path, updated_at: new Date().toISOString() })
    .eq("id", owner.booking.id)
    .select("id");

  // The file exists but is unlinked at this point, so report failure rather
  // than success — otherwise the operator would never know it was sent.
  if (updateError || !updated?.length) {
    return fail("Resit dimuat naik tetapi gagal dikaitkan. WhatsApp kami.", 500);
  }

  return NextResponse.json({ ok: true });
}
