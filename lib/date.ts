// Date helpers for the operator console. All "today"/"this week"/"this month"
// math is anchored to Asia/Kuala_Lumpur regardless of where the server process
// actually runs (Vercel functions default to UTC) — Malaysia is UTC+8, so a
// naive `new Date()` read as UTC would show the wrong calendar day for 16 of
// every 24 hours. Calendar dates (YYYY-MM-DD) are otherwise handled as plain
// UTC-anchored values once resolved, since they represent an abstract night
// on the calendar, not a real instant.

const MY_TZ = "Asia/Kuala_Lumpur";

const WEEKDAYS_MY = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const FULL_MONTHS_MY = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

/** Today's date in Malaysia local time, as YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function firstOfMonthISO(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** [start, end) of the calendar month before the one containing `iso`. */
export function previousMonthRangeISO(iso: string): { start: string; end: string } {
  const end = firstOfMonthISO(iso);
  const [y, m] = end.split("-").map(Number);
  const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
  return { start: toIso(prevMonthDate), end };
}

/** A YYYY-MM-DD calendar date, interpreted as Malaysia midnight, as a UTC instant. */
export function myMidnightUTC(iso: string): string {
  return new Date(`${iso}T00:00:00+08:00`).toISOString();
}

/** e.g. "Rabu, 3 September 2026" */
export function formatMalayFullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = toUtcDate(iso);
  return `${WEEKDAYS_MY[date.getUTCDay()]}, ${d} ${FULL_MONTHS_MY[m - 1]} ${y}`;
}

export function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

/** e.g. 12400 -> "RM 12.4k" for compact KPI tiles. */
export function formatRMCompact(amount: number): string {
  if (amount >= 1000) {
    return `RM ${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatRM(amount);
}
