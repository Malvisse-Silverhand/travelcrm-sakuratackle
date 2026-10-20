import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { KIND_LABEL, loadReceipt, paidAtText, receiptPdf, rmText, type ReceiptData } from "./receipt";
import { formatLongDate } from "@/lib/season";

// Sending a receipt to the customer: email with the PDF attached, or a
// WhatsApp message with the receipt link (the admin's phone sends it).

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function receiptAttachment(r: ReceiptData) {
  const bytes = await receiptPdf(r);
  return { filename: `${r.receiptNo}.pdf`, content: Buffer.from(bytes).toString("base64") };
}

export async function emailReceipt(paymentId: string): Promise<{ sent: boolean; reason?: string }> {
  const r = await loadReceipt({ id: paymentId });
  if (!r) return { sent: false, reason: "Receipt not found." };
  if (!r.booking.email) return { sent: false, reason: "This booking has no email address. Send it by WhatsApp." };
  if (r.voided) return { sent: false, reason: "A void receipt cannot be sent." };

  const first = r.booking.fullName.split(" ")[0];
  const what = KIND_LABEL[r.kind] ?? "Payment";
  const text = [
    `Hai ${first},`,
    "",
    `Ini resit rasmi ${r.receiptNo} untuk ${what.toLowerCase()} ${rmText(r.amount)} (tempahan ${r.booking.ref}, ${formatLongDate(r.booking.nightDate)}).`,
    r.kind === "refund" ? "" : r.balance > 0 ? `Baki untuk dibayar di jeti: ${rmText(r.balance)}.` : "Tempahan anda telah dibayar penuh.",
    "",
    `Lihat resit: ${r.url}`,
    "",
    `Terima kasih, ${r.business.name}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f2fe;font-family:Inter,Arial,sans-serif;padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#241a4d;color:#fff;padding:18px 24px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:18px">${esc(r.business.name.toUpperCase())}</td></tr>
<tr><td style="padding:24px;color:#1b1436;font-size:14px;line-height:1.6">
<p style="margin:0 0 12px">Hai ${esc(first)},</p>
<p style="margin:0 0 12px">Ini resit rasmi <b>${esc(r.receiptNo)}</b> untuk ${esc(what.toLowerCase())} <b>${esc(rmText(r.amount))}</b>, diterima ${esc(paidAtText(r.paidAt))}.</p>
<p style="margin:0 0 12px">Tempahan ${esc(r.booking.ref)} · ${esc(r.booking.boat)} · ${esc(formatLongDate(r.booking.nightDate))}${
    r.kind === "refund" ? "" : r.balance > 0 ? `<br>Baki di jeti: <b>${esc(rmText(r.balance))}</b>` : "<br><b>Dibayar penuh.</b>"
  }</p>
<p style="margin:18px 0"><a href="${esc(r.url)}" style="display:inline-block;padding:11px 20px;border-radius:12px;background:#ffb800;color:#2e1d6b;font-weight:700;text-decoration:none">View receipt</a></p>
<p style="margin:0;color:#635a87;font-size:12.5px">Resit PDF dilampirkan. Terima kasih kerana memilih ${esc(r.business.name)}.</p>
</td></tr></table></body></html>`;

  const result = await sendEmail({
    to: r.booking.email,
    subject: `Receipt ${r.receiptNo}: ${rmText(r.amount)} for ${r.booking.ref}`,
    text,
    html,
    attachments: [await receiptAttachment(r)],
  });
  if (!result.sent) return { sent: false, reason: result.error };
  await createAdminClient().from("payments").update({ emailed_at: new Date().toISOString() }).eq("id", paymentId).select("id");
  return { sent: true };
}

/** Text for the admin to send on WhatsApp (bahasa rojak). */
export function receiptWhatsappText(r: ReceiptData): string {
  const first = r.booking.fullName.split(" ")[0];
  const what = (KIND_LABEL[r.kind] ?? "Payment").toLowerCase();
  return [
    `Salam ${first}, terima kasih! Ini resit rasmi ${r.receiptNo} untuk ${what} ${rmText(r.amount)} (tempahan ${r.booking.ref}, ${formatLongDate(r.booking.nightDate)}).`,
    r.kind === "refund" ? "" : r.balance > 0 ? `Baki di jeti: ${rmText(r.balance)}.` : "Tempahan dah dibayar penuh.",
    "",
    `Resit: ${r.url}`,
  ]
    .filter((l, i) => l !== "" || i > 1)
    .join("\n");
}
