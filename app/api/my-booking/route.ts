import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, verifyBookingOwner } from "@/lib/booking/owner";
import { cancelQuote } from "@/lib/booking/cancellation";
import { todayISO } from "@/lib/date";

// Manage My Booking. Every action proves the reference and the phone belong
// together first (bookings has no anon policy; this is the service role),
// then does one narrow thing:
//   view        the booking, its guest names, open requests and review
//   cancel      cancel now; the refund the terms give is recorded for the admin
//   reschedule  ask to move to another night (an admin applies it)
//   review      rate the trip once, after it has happened

type Body = {
  action?: string;
  ref?: unknown;
  phone?: unknown;
  newDate?: unknown;
  note?: unknown;
  rating?: unknown;
  comment?: unknown;
  name?: unknown;
};

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return fail("Permintaan tidak sah.");
  }
  const ref = String(body.ref ?? "").trim().toUpperCase();
  const phone = normalisePhone(String(body.phone ?? ""));
  if (!ref || !phone) return fail("Sila isi nombor rujukan dan nombor telefon.");

  const db = createAdminClient();
  const owner = await verifyBookingOwner(db, ref, phone);
  if (!owner.ok) return fail(owner.message, owner.status);
  const id = owner.booking.id;

  const { data: b } = await db
    .from("bookings")
    .select(
      "id, ref, full_name, night_date, pax, status, pricing, total_amount, deposit_amount, deposit_paid, pay_plan, receipt_url, boat_id, boats(code, display_name, capacity, jetties(name, subtitle))"
    )
    .eq("id", id)
    .single();
  if (!b) return fail("Tempahan tidak dijumpai.", 404);

  const today = todayISO();
  const upcoming = b.night_date >= today;
  const live = b.status !== "cancelled";

  switch (body.action) {
    case "view": {
      const [{ data: names }, { data: requests }, { data: review }] = await Promise.all([
        db.from("booking_pax").select("full_name").eq("booking_id", id).order("sort_order"),
        db
          .from("booking_requests")
          .select("kind, new_date, status, refund_amount, created_at")
          .eq("booking_id", id)
          .order("created_at", { ascending: false }),
        db.from("reviews").select("rating, comment, status").eq("booking_id", id).maybeSingle(),
      ]);
      return NextResponse.json({
        booking: b,
        names: (names ?? []).map((n) => n.full_name),
        requests: requests ?? [],
        review,
        today,
        cancel: live && upcoming ? cancelQuote(b, today) : null,
        canChange: live && upcoming,
        canReview: live && !upcoming && !review,
      });
    }

    case "cancel": {
      if (!live) return fail("Tempahan ini sudah dibatalkan.");
      if (!upcoming) return fail("Trip ini sudah berlalu.");
      const quote = cancelQuote(b, today);
      const { data: done } = await db
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .neq("status", "cancelled")
        .select("id");
      if (!done?.length) return fail("Tidak dapat membatalkan sekarang. Cuba lagi atau WhatsApp kami.", 503);
      // A date change asked for earlier no longer applies.
      await db
        .from("booking_requests")
        .update({ status: "declined", resolved_at: new Date().toISOString() })
        .eq("booking_id", id)
        .eq("kind", "reschedule")
        .eq("status", "open")
        .select("id");
      await db.from("booking_requests").insert({
        booking_id: id,
        kind: "cancel",
        note: String(body.note ?? "").slice(0, 1000) || null,
        refund_amount: quote.refund,
        // Nothing to pay back means nothing left for the admin to do.
        status: quote.refund > 0 ? "open" : "done",
      });
      return NextResponse.json({ ok: true, quote });
    }

    case "reschedule": {
      if (!live) return fail("Tempahan ini sudah dibatalkan.");
      if (!upcoming) return fail("Trip ini sudah berlalu.");
      const newDate = String(body.newDate ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate <= today) return fail("Pilih tarikh baru yang sah.");
      if (newDate === b.night_date) return fail("Itu tarikh tempahan anda sekarang.");
      const { data: av } = await db.rpc("get_boat_availability", {
        p_from: newDate,
        p_to: newDate,
        p_boat_id: b.boat_id,
      });
      const night = (av ?? [])[0] as { status: string } | undefined;
      if (!night || night.status === "full") return fail("Malam itu tidak dibuka untuk bot ini. Pilih tarikh lain.");
      const { data: open } = await db
        .from("booking_requests")
        .select("id")
        .eq("booking_id", id)
        .eq("kind", "reschedule")
        .eq("status", "open");
      if (open?.length) return fail("Permintaan tukar tarikh anda sedang diproses. Kami WhatsApp anda.");
      const { error } = await db.from("booking_requests").insert({
        booking_id: id,
        kind: "reschedule",
        new_date: newDate,
        note: String(body.note ?? "").slice(0, 1000) || null,
      });
      if (error) return fail("Tidak dapat menghantar permintaan sekarang.", 503);
      return NextResponse.json({ ok: true });
    }

    case "review": {
      if (!live || upcoming) return fail("Ulasan boleh dihantar selepas trip.");
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Pilih 1 hingga 5 bintang.");
      const name = String(body.name ?? "").trim().slice(0, 60) || b.full_name.split(" ")[0];
      const comment = String(body.comment ?? "").trim().slice(0, 1000) || null;
      const { error } = await db
        .from("reviews")
        .insert({ booking_id: id, boat_id: b.boat_id, name, rating, comment });
      if (error) {
        return fail(error.code === "23505" ? "Anda dah hantar ulasan untuk trip ini. Terima kasih!" : "Tidak dapat menyimpan ulasan sekarang.", 409);
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return fail("Tindakan tidak dikenali.");
  }
}
