import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { normalizePhoneLocal } from "@/lib/phone";
import { EMAIL_RE, escapeHtml, logActivity, originOf } from "@/lib/admin/invites";

// Public: a boat owner applies to become a vendor (VendorSignup block in the
// page builder). vendor_applications has no anon policy, so the input is
// checked here and written with the service role. Admins review it in
// Admin → Vendor applications.

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Bots fill the hidden field; tell them it worked and keep nothing.
  if (clip(body.website, 200)) return NextResponse.json({ ok: true });

  const fullName = clip(body.fullName, 80);
  const email = clip(body.email, 160).toLowerCase();
  const phone = normalizePhoneLocal(clip(body.phone, 20));
  const boatCount = Math.min(50, Math.max(1, Math.round(Number(body.boatCount) || 1)));

  if (fullName.length < 2) return NextResponse.json({ error: "Sila isi nama penuh." }, { status: 400 });
  if (!/^[0-9]{9,12}$/.test(phone)) return NextResponse.json({ error: "No. telefon tak sah." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email tak sah." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Sila tanda kotak persetujuan." }, { status: 400 });

  const admin = createAdminClient();

  // The same person sending twice in a day gets one application.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const recent = (col: "phone" | "email", v: string) =>
    admin
      .from("vendor_applications")
      .select("id")
      .eq("status", "new")
      .eq(col, v)
      .gte("created_at", since)
      .limit(1);
  const [byPhone, byEmail] = await Promise.all([recent("phone", phone), recent("email", email)]);
  if (byPhone.data?.length || byEmail.data?.length) return NextResponse.json({ ok: true });

  const row = {
    full_name: fullName,
    business_name: clip(body.business, 120) || null,
    email,
    phone,
    jetty: clip(body.jetty, 80) || null,
    boat_count: boatCount,
    boat_details: clip(body.boats, 1000) || null,
    message: clip(body.message, 1000) || null,
    source_page: clip(body.source, 60) || null,
  };
  const { data: app, error } = await admin.from("vendor_applications").insert(row).select("id").single();
  if (error || !app) return NextResponse.json({ error: "Tak dapat hantar. Cuba lagi sekejap." }, { status: 500 });

  await logActivity(
    { id: null, name: fullName },
    "vendor.applied",
    "vendor_application",
    app.id,
    `${fullName} applied to be a vendor (${boatCount} boat${boatCount === 1 ? "" : "s"}${row.jetty ? `, ${row.jetty}` : ""})`
  );

  // Heads-up to the operator's inbox, when email is set up.
  const inbox = process.env.RESEND_REPLY_TO;
  if (inbox) {
    const link = `${originOf(request).replace(/\/$/, "")}/admin/vendor-applications`;
    await sendEmail({
      to: inbox,
      replyTo: email,
      subject: `New vendor application: ${fullName}`,
      text: `${fullName} (${phone}, ${email}) applied to be a vendor with ${boatCount} boat(s)${row.jetty ? ` at ${row.jetty}` : ""}. Review: ${link}`,
      html: `<p><b>${escapeHtml(fullName)}</b> (${escapeHtml(phone)}, ${escapeHtml(email)}) applied to be a vendor with ${boatCount} boat(s)${
        row.jetty ? ` at ${escapeHtml(row.jetty)}` : ""
      }.</p>${row.boat_details ? `<p>${escapeHtml(row.boat_details)}</p>` : ""}<p><a href="${link}">Review the application</a></p>`,
    });
  }

  return NextResponse.json({ ok: true });
}
