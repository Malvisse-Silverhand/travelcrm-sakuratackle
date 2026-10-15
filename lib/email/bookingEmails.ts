import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/email/resend";
import { amountPaid, balanceDue, bookingTotal, upfrontAmount } from "@/lib/booking/amounts";
import { tripIcs } from "@/lib/booking/ics";
import { formatLongDate } from "@/lib/season";
import { BANK, JETTY } from "@/lib/content/site";
import { ITINERARY, PREPARATION, WAZE_URL, rm } from "@/lib/content/booking";
import { SITE_URL } from "@/lib/site-url";
import { waLink } from "@/lib/whatsapp";

// Customer emails for a booking. Each kind goes out at most once per booking:
// the column below is claimed (set where it is null) before sending and
// cleared again if Resend refuses, so a failure can be retried but nothing is
// ever sent twice. Copy is bahasa rojak with English headings, like the site.

export type EmailKind = "confirmation" | "paid" | "reminder";

const SENT_COLUMN: Record<EmailKind, "confirmation_sent_at" | "paid_email_sent_at" | "reminder_sent_at"> = {
  confirmation: "confirmation_sent_at",
  paid: "paid_email_sent_at",
  reminder: "reminder_sent_at",
};

type Row = {
  id: string;
  ref: string;
  full_name: string;
  email: string | null;
  night_date: string;
  pax: number;
  status: string;
  total_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  pay_plan: string | null;
  boats: {
    code: string;
    display_name: string | null;
    jetties: { name: string; subtitle: string } | null;
  } | null;
};

export type SendResult = { sent: boolean; reason?: string };

export async function sendBookingEmail(kind: EmailKind, bookingId: string): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, reason: "Email is not set up yet (Resend)." };
  const db = createAdminClient();
  const column = SENT_COLUMN[kind];

  // Claim the send. No row back means: no email address, already sent, or
  // no such booking; all three mean "do nothing".
  const { data: claimed } = await db
    .from("bookings")
    .update({ [column]: new Date().toISOString() })
    .eq("id", bookingId)
    .is(column, null)
    .not("email", "is", null)
    .select("id");
  if (!claimed?.length) return { sent: false, reason: "No email address, or already sent." };

  const [{ data: b }, { data: org }] = await Promise.all([
    db
      .from("bookings")
      .select(
        "id, ref, full_name, email, night_date, pax, status, total_amount, deposit_amount, deposit_paid, pay_plan, boats(code, display_name, jetties(name, subtitle))"
      )
      .eq("id", bookingId)
      .maybeSingle<Row>(),
    db.from("org_settings").select("business_name, whatsapp_number, hold_hours").eq("id", 1).maybeSingle(),
  ]);

  const release = () => db.from("bookings").update({ [column]: null }).eq("id", bookingId).select("id");

  if (!b?.email) {
    await release();
    return { sent: false, reason: "Booking not found." };
  }

  const mail = composeBookingEmail(kind, b, {
    business: org?.business_name ?? "Sakura Tackle",
    wa: org?.whatsapp_number ?? "601153598055",
    holdHours: org?.hold_hours ?? 48,
  });
  const result = await sendEmail({ to: b.email, ...mail });
  if (!result.sent) {
    await release();
    return { sent: false, reason: result.error };
  }
  return { sent: true };
}

/** Day-before reminders, from the daily cron. Returns how many were sent. */
export async function sendTripReminders(tomorrowISO: string): Promise<number> {
  if (!emailConfigured()) return 0;
  const { data } = await createAdminClient()
    .from("bookings")
    .select("id")
    .eq("night_date", tomorrowISO)
    .in("status", ["confirmed", "deposit_due"])
    .not("email", "is", null)
    .is("reminder_sent_at", null);
  let sent = 0;
  for (const row of data ?? []) {
    if ((await sendBookingEmail("reminder", row.id)).sent) sent += 1;
  }
  return sent;
}

// ------------------------------------------------------------------ copy --

type Ctx = { business: string; wa: string; holdHours: number };

/** Exported for previews and tests; sendBookingEmail is the real entry point. */
export function composeBookingEmail(kind: EmailKind, b: Row, ctx: Ctx) {
  const boat = b.boats?.display_name ?? b.boats?.code ?? "Bot";
  const jetty = b.boats?.jetties?.subtitle || b.boats?.jetties?.name || "Jeti Marang, Terengganu";
  const date = formatLongDate(b.night_date);
  const total = bookingTotal(b);
  const upfront = upfrontAmount(b);
  const paid = amountPaid(b);
  const balance = balanceDue(b);
  const firstName = b.full_name.split(" ")[0];
  const waHref = waLink(
    ctx.wa,
    `Hai ${ctx.business}! Saya ${b.full_name}, tempahan ${b.ref} (${boat}, ${date}).\n\nSoalan saya: ___\n\n${SITE_URL}/`
  );

  const details: Array<[string, string]> = [
    ["Booking reference", b.ref],
    ["Boat", boat],
    ["Date", `${date} (bertolak selepas Asar, pulang 7:00 pagi)`],
    ["Jetty", jetty],
    ["Group", `${b.pax} orang`],
    ["Total", rm(total)],
  ];

  if (kind === "confirmation") {
    const receiptUrl = `${SITE_URL}/resit?ref=${encodeURIComponent(b.ref)}`;
    details.push(
      [b.pay_plan === "full" ? "Pay now (full)" : "Pay now (deposit)", rm(upfront)],
      ["Balance at jetty", rm(Math.max(0, total - upfront))]
    );
    return build({
      subject: `Booking received: ${b.ref}, ${boat}, ${date}`,
      heading: "Booking received",
      intro: `Hai ${firstName}, terima kasih! Tempahan anda dah masuk sistem kami. Malam ini ditahan untuk anda selama ${ctx.holdHours} jam sementara menunggu bayaran.`,
      details,
      sections: [
        {
          title: "How to pay",
          lines: [
            `Pindahkan ${rm(upfront)} ke akaun ini dan guna ${b.ref} sebagai rujukan:`,
            `${BANK.bank} · ${BANK.accountName} · ${BANK.accountNumber}`,
            `Kemudian muat naik resit di sini: ${receiptUrl}`,
            `Tiada bayaran dalam ${ctx.holdHours} jam? Tempahan dibatalkan secara automatik dan malam itu dibuka semula.`,
          ],
          button: { label: "Upload Receipt", href: receiptUrl },
        },
      ],
      waHref,
      business: ctx.business,
    });
  }

  if (kind === "paid") {
    details.push(["Paid", rm(paid)], ["Balance at jetty", rm(balance)]);
    return {
      ...build({
        subject: `Payment received, you're confirmed: ${b.ref}, ${date}`,
        heading: "You're confirmed!",
        intro: `Hai ${firstName}, bayaran ${rm(paid)} dah diterima dan slot anda dikunci. Jumpa di jeti!`,
        details,
        sections: [
          balance > 0
            ? { title: "Balance", lines: [`Bayar baki ${rm(balance)} di jeti sebelum bertolak.`] }
            : { title: "Balance", lines: ["Tiada baki. Terus naik bot!"] },
          jettySection(jetty),
          {
            title: "The night",
            lines: ITINERARY.map((it) => `${it.time}: ${it.title}. ${it.body}`),
          },
          { title: "Before you sail", lines: [PREPARATION] },
          {
            title: "Calendar",
            lines: ["Fail kalendar (.ics) dilampirkan. Buka untuk simpan trip ini dalam kalendar telefon anda."],
          },
        ],
        waHref,
        business: ctx.business,
      }),
      attachments: [
        {
          filename: `trip-candat-${b.ref}.ics`,
          content: Buffer.from(
            tripIcs({
              ref: b.ref,
              nightDate: b.night_date,
              boat,
              pax: b.pax,
              location: `${jetty} (${JETTY.address})`,
              details: `Tempahan ${b.ref}, ${b.pax} orang. Baki di jeti: ${rm(balance)}. Google Maps: ${JETTY.mapsUrl}`,
            })
          ).toString("base64"),
        },
      ],
    };
  }

  // reminder
  details.push(["Balance at jetty", rm(balance)]);
  return build({
    subject: `Trip tomorrow: ${boat}, ${date}`,
    heading: "See you tomorrow!",
    intro: `Hai ${firstName}, trip candat sotong anda esok. Berkumpul di jeti sebelum Asar untuk taklimat keselamatan.`,
    details,
    sections: [
      jettySection(jetty),
      { title: "Before you sail", lines: [PREPARATION] },
      balance > 0
        ? { title: "Balance", lines: [`Sediakan baki ${rm(balance)} untuk dibayar di jeti sebelum bertolak.`] }
        : { title: "Balance", lines: ["Tiada baki. Bawa diri dan semangat je!"] },
      {
        title: "Weather",
        lines: [`Kalau cuaca tak selamat, kapten akan hubungi anda. Polisi cuaca: ${SITE_URL}/polisi#cuaca`],
      },
    ],
    waHref,
    business: ctx.business,
  });
}

function jettySection(jetty: string) {
  return {
    title: "Jetty Guide",
    lines: [`${jetty}: ${JETTY.address}`, `Google Maps: ${JETTY.mapsUrl}`, `Waze: ${WAZE_URL}`],
    button: { label: "Open in Google Maps", href: JETTY.mapsUrl },
  };
}

// ---------------------------------------------------------------- layout --

type Section = { title: string; lines: string[]; button?: { label: string; href: string } };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Turn bare https links in a line into anchors (after escaping). */
const linkify = (s: string) =>
  esc(s).replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#2e1d6b">${u}</a>`);

function build(m: {
  subject: string;
  heading: string;
  intro: string;
  details: Array<[string, string]>;
  sections: Section[];
  waHref: string;
  business: string;
}) {
  const rows = m.details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#635a87;font-size:13px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600;font-size:14px;color:#1b1436">${esc(v)}</td></tr>`
    )
    .join("");
  const sections = m.sections
    .map(
      (s) =>
        `<h3 style="margin:22px 0 8px;font-family:Poppins,Arial,sans-serif;font-size:16px;color:#1b1436">${esc(s.title)}</h3>` +
        s.lines.map((l) => `<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#4a3f6e">${linkify(l)}</p>`).join("") +
        (s.button
          ? `<p style="margin:12px 0 0"><a href="${esc(s.button.href)}" style="display:inline-block;padding:11px 20px;border-radius:12px;background:#ffb800;color:#2e1d6b;font-weight:700;text-decoration:none">${esc(s.button.label)}</a></p>`
          : "")
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f5f2fe;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2fe;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#241a4d;padding:22px 24px;color:#fff;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:18px;letter-spacing:.02em">SAKURA TACKLE<div style="font-size:12px;font-weight:500;color:#ffe39a;letter-spacing:.1em">TRIP CANDAT SOTONG</div></td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 8px;font-family:Poppins,Arial,sans-serif;font-size:22px;color:#1b1436">${esc(m.heading)}</h2>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4a3f6e">${esc(m.intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ede7fb;border-bottom:1px solid #ede7fb">${rows}</table>
${sections}
<p style="margin:24px 0 0"><a href="${esc(m.waHref)}" style="display:inline-block;padding:11px 20px;border-radius:12px;background:#128c7e;color:#fff;font-weight:700;text-decoration:none">WhatsApp Us</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fbfaff;font-size:12px;color:#7a6fa0">${esc(m.business)} · Jeti Marang, Terengganu · <a href="${SITE_URL}/polisi" style="color:#7a6fa0">Booking terms &amp; privacy</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    m.heading,
    "",
    m.intro,
    "",
    ...m.details.map(([k, v]) => `${k}: ${v}`),
    ...m.sections.flatMap((s) => ["", s.title.toUpperCase(), ...s.lines]),
    "",
    `WhatsApp: ${m.waHref}`,
    `Terma tempahan: ${SITE_URL}/polisi`,
  ].join("\n");

  return { subject: m.subject, html, text };
}
