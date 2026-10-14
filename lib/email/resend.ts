import "server-only";

// Transactional email through Resend's HTTP API (no SDK dependency).
// Needs RESEND_API_KEY and RESEND_FROM (e.g. "Sakura Tackle <admin@sakuratackle.com>",
// on a domain verified in Resend). Until both are set, sending is skipped
// and callers fall back to the link / WhatsApp, so nothing breaks.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) return { sent: false, error: "Email is not set up yet (Resend)." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM, ...input }),
    });
    if (!res.ok) return { sent: false, error: `Resend refused the email (${res.status}).` };
    return { sent: true };
  } catch {
    return { sent: false, error: "Could not reach Resend." };
  }
}
