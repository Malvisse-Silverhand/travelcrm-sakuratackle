import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatLongDate } from "@/lib/season";
import { SITE_URL } from "@/lib/site-url";
import { normalizePhoneLocal } from "@/lib/phone";

// Official receipts: one per row in `payments`. The public page
// (/receipt/<token>) and the PDF emailed to the customer are built from the
// same data, read with the service role by the receipt's unguessable token
// (or by id for admins).

export const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  full: "Full payment",
  balance: "Balance payment",
  refund: "Refund",
  other: "Payment",
};

export const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  duitnow: "DuitNow",
  cash: "Cash",
  card: "Card",
  online: "Online payment",
  other: "Other",
};

export type ReceiptData = {
  id: string;
  receiptNo: string;
  token: string;
  kind: string;
  amount: number;
  method: string;
  paidAt: string;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
  booking: {
    id: string;
    ref: string;
    fullName: string;
    phone: string;
    email: string | null;
    nightDate: string;
    pax: number;
    boat: string;
    total: number;
  };
  /** All valid payments on the booking up to and including this one. */
  paidToDate: number;
  balance: number;
  business: {
    name: string;
    legalName: string | null;
    ssmNo: string | null;
    sstNo: string | null;
    address: string | null;
    email: string | null;
    whatsapp: string;
    location: string;
  };
  url: string;
};

export async function loadReceipt(by: { token?: string; id?: string }): Promise<ReceiptData | null> {
  const db = createAdminClient();
  const q = db
    .from("payments")
    .select(
      "id, booking_id, kind, amount, method, paid_at, note, receipt_no, receipt_token, voided_at, void_reason, bookings(id, ref, full_name, phone, email, night_date, pax, total_amount, boats(code, display_name))"
    );
  const { data: p } = by.token ? await q.eq("receipt_token", by.token).maybeSingle() : await q.eq("id", by.id!).maybeSingle();
  if (!p) return null;
  const b = (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings) as unknown as {
    id: string;
    ref: string;
    full_name: string;
    phone: string;
    email: string | null;
    night_date: string;
    pax: number;
    total_amount: number;
    boats: { code: string; display_name: string | null } | null;
  };

  const [{ data: all }, { data: org }] = await Promise.all([
    db.from("payments").select("kind, amount, paid_at, voided_at, receipt_no").eq("booking_id", p.booking_id),
    db
      .from("org_settings")
      .select("business_name, legal_name, ssm_no, sst_no, address, business_email, whatsapp_number, location")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  const upTo = (all ?? []).filter(
    (x) => !x.voided_at && (x.paid_at < p.paid_at || (x.paid_at === p.paid_at && (x.receipt_no ?? "") <= (p.receipt_no ?? "")))
  );
  const paidToDate = upTo.reduce((s, x) => s + (x.kind === "refund" ? -Number(x.amount) : Number(x.amount)), 0);
  const total = Number(b.total_amount);

  return {
    id: p.id,
    receiptNo: p.receipt_no ?? "",
    token: p.receipt_token,
    kind: p.kind,
    amount: Number(p.amount),
    method: p.method,
    paidAt: p.paid_at,
    note: p.note,
    voided: !!p.voided_at,
    voidReason: p.void_reason,
    booking: {
      id: b.id,
      ref: b.ref,
      fullName: b.full_name,
      phone: normalizePhoneLocal(b.phone),
      email: b.email,
      nightDate: b.night_date,
      pax: b.pax,
      boat: b.boats?.display_name ?? b.boats?.code ?? "Boat",
      total,
    },
    paidToDate,
    balance: p.kind === "refund" ? 0 : Math.max(0, total - paidToDate),
    business: {
      name: org?.business_name ?? "Sakura Tackle",
      legalName: org?.legal_name ?? null,
      ssmNo: org?.ssm_no ?? null,
      sstNo: org?.sst_no ?? null,
      address: org?.address ?? null,
      email: org?.business_email ?? null,
      whatsapp: org?.whatsapp_number ?? "",
      location: org?.location ?? "Jeti Marang, Terengganu",
    },
    url: `${SITE_URL}/receipt/${p.receipt_token}`,
  };
}

export function rmText(n: number): string {
  return "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function paidAtText(iso: string): string {
  const d = new Date(iso);
  const date = formatLongDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(d));
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date}, ${time}`;
}

/** The receipt as an A4 PDF, for email attachments. */
export async function receiptPdf(r: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${r.receiptNo}`);
  pdf.setAuthor(r.business.name);
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const purple = rgb(0.18, 0.11, 0.42);
  const ink = rgb(0.11, 0.08, 0.21);
  const muted = rgb(0.39, 0.35, 0.53);
  const gold = rgb(1, 0.72, 0);
  const W = page.getWidth();
  const M = 48;
  let y = 841.89 - M;

  // Header band
  page.drawRectangle({ x: 0, y: 841.89 - 120, width: W, height: 120, color: rgb(0.14, 0.1, 0.3) });
  try {
    const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public/brand/logo-email.png")));
    page.drawImage(logo, { x: M, y: 841.89 - 104, width: 76, height: 76 });
  } catch {
    // Logo is decoration; the receipt stands without it.
  }
  page.drawText(r.business.name.toUpperCase(), { x: M + 92, y: 841.89 - 56, size: 18, font: bold, color: rgb(1, 1, 1) });
  const headLines = [
    r.business.legalName && r.business.legalName !== r.business.name ? r.business.legalName : null,
    r.business.ssmNo ? `SSM ${r.business.ssmNo}` : null,
    r.business.address ?? r.business.location,
  ].filter(Boolean) as string[];
  headLines.forEach((t, i) =>
    page.drawText(t.slice(0, 80), { x: M + 92, y: 841.89 - 74 - i * 13, size: 9.5, font, color: rgb(0.85, 0.82, 0.95) })
  );

  y = 841.89 - 160;
  const title = r.kind === "refund" ? "REFUND RECEIPT" : "OFFICIAL RECEIPT";
  page.drawText(title, { x: M, y, size: 20, font: bold, color: purple });
  page.drawText(r.receiptNo, { x: W - M - bold.widthOfTextAtSize(r.receiptNo, 14), y: y + 2, size: 14, font: bold, color: ink });
  y -= 18;
  const dateLine = `Date: ${paidAtText(r.paidAt)}`;
  page.drawText(dateLine, { x: W - M - font.widthOfTextAtSize(dateLine, 10), y, size: 10, font, color: muted });
  if (r.voided) {
    page.drawText(`VOID${r.voidReason ? `: ${r.voidReason}` : ""}`, { x: M, y, size: 11, font: bold, color: rgb(0.76, 0.17, 0.17) });
  }

  // Received from
  y -= 34;
  page.drawText(r.kind === "refund" ? "REFUNDED TO" : "RECEIVED FROM", { x: M, y, size: 8.5, font: bold, color: muted });
  y -= 16;
  page.drawText(r.booking.fullName, { x: M, y, size: 13, font: bold, color: ink });
  y -= 14;
  page.drawText(`${r.booking.phone}${r.booking.email ? `  ·  ${r.booking.email}` : ""}`, { x: M, y, size: 10, font, color: muted });

  // Line item table
  y -= 34;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: rgb(0.95, 0.93, 0.99) });
  page.drawText("DESCRIPTION", { x: M + 10, y: y + 2, size: 8.5, font: bold, color: muted });
  page.drawText("AMOUNT", { x: W - M - 10 - bold.widthOfTextAtSize("AMOUNT", 8.5), y: y + 2, size: 8.5, font: bold, color: muted });
  y -= 30;
  const desc = `${KIND_LABEL[r.kind] ?? "Payment"}: squid-jigging trip ${r.booking.ref}`;
  page.drawText(desc, { x: M + 10, y, size: 11, font: bold, color: ink });
  const amt = rmText(r.amount);
  page.drawText(amt, { x: W - M - 10 - bold.widthOfTextAtSize(amt, 11), y, size: 11, font: bold, color: ink });
  y -= 15;
  page.drawText(`${r.booking.boat} · ${formatLongDate(r.booking.nightDate)} · ${r.booking.pax} pax`, {
    x: M + 10,
    y,
    size: 9.5,
    font,
    color: muted,
  });
  y -= 13;
  page.drawText(`Paid by ${METHOD_LABEL[r.method] ?? r.method}${r.note ? ` · ${r.note.slice(0, 70)}` : ""}`, {
    x: M + 10,
    y,
    size: 9.5,
    font,
    color: muted,
  });

  // Totals
  y -= 26;
  page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.8, color: rgb(0.88, 0.85, 0.96) });
  const rows: Array<[string, string, boolean]> =
    r.kind === "refund"
      ? [["Amount refunded", rmText(r.amount), true]]
      : [
          ["Trip total", rmText(r.booking.total), false],
          ["Paid to date", rmText(r.paidToDate), false],
          ["Balance", r.balance > 0 ? rmText(r.balance) : "Fully paid", true],
        ];
  for (const [k, v, strong] of rows) {
    const f = strong ? bold : font;
    page.drawText(k, { x: W - M - 230, y, size: 10.5, font: f, color: ink });
    page.drawText(v, { x: W - M - 10 - f.widthOfTextAtSize(v, 10.5), y, size: 10.5, font: f, color: strong ? purple : ink });
    y -= 18;
  }
  if (r.business.sstNo) {
    page.drawText(`SST registration no. ${r.business.sstNo}. Amounts include SST where applicable.`, {
      x: M,
      y: y - 6,
      size: 9,
      font,
      color: muted,
    });
    y -= 18;
  }

  // Footer
  page.drawRectangle({ x: M, y: 90, width: W - 2 * M, height: 3, color: gold });
  const foot = [
    "Thank you for sailing with us. This receipt was issued electronically and is valid without a signature.",
    `Verify: ${r.url}`,
    [r.business.email, r.business.whatsapp ? `WhatsApp +${r.business.whatsapp}` : null, SITE_URL.replace(/^https?:\/\//, "")]
      .filter(Boolean)
      .join("  ·  "),
  ];
  foot.forEach((t, i) =>
    page.drawText(t.slice(0, 150), { x: M, y: 74 - i * 13, size: t.startsWith("Verify") ? 7 : 8.5, font, color: muted })
  );

  return pdf.save();
}
