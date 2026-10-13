// Season calendar helpers.
//
// The season is NOT hardcoded here any more. Its dates are the published
// package's `season_start` / `season_end`, which the operator edits in
// Settings, and the nights actually on sale are the `trip_nights` rows inside
// that range. Every page builds its month list from those with
// `monthsBetween`, so moving the season in Settings moves the public
// calendar, the hero search, the admin calendar and the reports together.
//
// What stays here: Malay month names, public holidays (keyed by date, so they
// survive the season moving), and the group-size options.

export type SeasonMonth = {
  /** Malay month name shown in the UI */
  name: string;
  /** JS month index (0 = January) */
  m: number;
  /** calendar year this entry belongs to */
  year: number;
  days: number;
};

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember",
];

/** Used only when the published package has no season set yet, so a fresh
 *  database still renders something sensible. */
export const FALLBACK_SEASON = { start: "2027-03-01", end: "2027-09-30" };

/** The longest season Settings accepts. Longer ranges are almost certainly a
 *  typo in the year, and would make every season query needlessly large. */
export const MAX_SEASON_MONTHS = 24;

/** Public holidays in Malaysia (federal), by date. Add the next year's dates
 *  here when the operator opens a new season; a missing year just shows no
 *  holiday chips, nothing breaks. */
export const HOLIDAYS_BY_DATE: Record<string, string> = {
  "2027-03-09": "Hari Raya Aidilfitri",
  "2027-03-10": "Hari Raya Aidilfitri",
  "2027-05-01": "Hari Pekerja",
  "2027-05-17": "Hari Raya Aidiladha",
  "2027-05-20": "Hari Wesak",
  "2027-06-07": "Keputeraan Agong",
  "2027-06-29": "Awal Muharram",
  "2027-08-31": "Hari Kebangsaan",
  "2027-09-06": "Maulidur Rasul",
  "2027-09-16": "Hari Malaysia",
};

export type Holiday = { d: number; n: string };

/** Monday-first, matching the design's dowLabels. */
export const DOW_LABELS = ["ISN", "SEL", "RAB", "KHA", "JUM", "SAB", "AHD"];

/** Group-size chips above the calendar, and the search control's options.
 *  v2 opens the floor to 4 pax (v1 was 6). */
export const PAX_CHIPS = [4, 6, 8, 10, 12, 15];
export const PAX_OPTIONS = [4, 6, 8, 10, 12, 15];

const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(year: number, m: number): number {
  return new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
}

/** Every calendar month that overlaps [start, end] (ISO dates), in order. */
export function monthsBetween(start: string, end: string): SeasonMonth[] {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const out: SeasonMonth[] = [];
  let year = sy;
  let m = sm - 1;
  while (year < ey || (year === ey && m <= em - 1)) {
    out.push({ name: MONTH_NAMES[m], m, year, days: daysIn(year, m) });
    m += 1;
    if (m === 12) {
      m = 0;
      year += 1;
    }
    if (out.length > 120) break; // corrupt range; never loop forever
  }
  return out;
}

/** "YYYY-MM" for a month, the key availability rows are grouped by. */
export function monthKey(month: SeasonMonth): string {
  return `${month.year}-${pad(month.m + 1)}`;
}

/** ISO date of a day in a month. */
export function monthISO(month: SeasonMonth, day: number): string {
  return `${monthKey(month)}-${pad(day)}`;
}

export function monthFirstISO(month: SeasonMonth): string {
  return monthISO(month, 1);
}

export function monthLastISO(month: SeasonMonth): string {
  return monthISO(month, month.days);
}

/** e.g. "Mac 2027" */
export function monthLabel(month: SeasonMonth): string {
  return `${month.name} ${month.year}`;
}

/** Index of the month an ISO date falls in, or null when it is not in the
 *  list (outside the season, or in a month with no trip nights). */
export function monthIdxIn(months: SeasonMonth[], iso: string): number | null {
  const key = iso.slice(0, 7);
  const idx = months.findIndex((m) => monthKey(m) === key);
  return idx === -1 ? null : idx;
}

/** First month not entirely in the past — where an admin calendar opens.
 *  Falls back to the last month once the whole list has passed. */
export function currentMonthIdxIn(months: SeasonMonth[], today: string): number {
  const idx = months.findIndex((m) => monthKey(m) >= today.slice(0, 7));
  return idx === -1 ? Math.max(0, months.length - 1) : idx;
}

export function holidaysIn(month: SeasonMonth): Holiday[] {
  const prefix = `${monthKey(month)}-`;
  return Object.entries(HOLIDAYS_BY_DATE)
    .filter(([iso]) => iso.startsWith(prefix))
    .map(([iso, n]) => ({ d: Number(iso.slice(8, 10)), n }))
    .sort((a, b) => a.d - b.d);
}

/** Formats an ISO date as e.g. "17 Mac 2027". */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1] ?? m} ${y}`;
}

/** e.g. "1 Mac 2027 – 30 September 2027", or "Not set". Admin-facing. */
export function seasonLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "Not set";
  return `${formatLongDate(start)} – ${formatLongDate(end)}`;
}

/** Validates a season range typed in Settings. Returns a message for the
 *  operator (admin UI is English), or null when the range is usable. */
export function seasonRangeError(start: string, end: string, today: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(start) || !iso.test(end)) return "Pick both a start and an end date.";
  if (start > end) return "The end date must be after the start date.";
  if (end < today) return "The end date has already passed. A season must end in the future.";
  if (monthsBetween(start, end).length > MAX_SEASON_MONTHS) {
    return `That is longer than ${MAX_SEASON_MONTHS} months. Check the year.`;
  }
  return null;
}
