// An .ics calendar entry for a trip night: the customer's "Add to Calendar"
// on the Done step, and the attachment on the payment-received email.
//
// Times are fixed to the trip's shape: gather before Asar (taken as 17:00
// Malaysia time) and back at the jetty 07:00 the next morning. Written in UTC
// so every calendar app places it correctly.

const pad = (n: number) => String(n).padStart(2, "0");

/** 17:00 MYT (UTC+8) on the night, to 07:00 MYT the next morning. */
function tripWindowUTC(nightISO: string): { start: string; end: string } {
  const [y, m, d] = nightISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 17 - 8, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 7 - 8, 0));
  const fmt = (t: Date) =>
    `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
  return { start: fmt(start), end: fmt(end) };
}

/** RFC 5545 text: escape \ , ; and newlines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

export function tripIcs(b: {
  ref: string;
  nightDate: string;
  boat: string;
  pax: number;
  location: string;
  details: string;
}): string {
  const { start, end } = tripWindowUTC(b.nightDate);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sakura Tackle//Trip Candat Sotong//MS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.ref}@sakuratackle`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(`Trip Candat Sotong: ${b.boat} (${b.ref})`)}`,
    `LOCATION:${esc(b.location)}`,
    `DESCRIPTION:${esc(b.details)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT3H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Trip candat sotong hari ini. Berkumpul di jeti sebelum Asar.",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
