// Season + holiday constants. Hardcoded on purpose — §8 of the build prompt
// rules out a public-holiday API for this phase.
//
// v2 sells two seasons: the tail of Mac–September 2026 and the full
// Mac–September 2027. The month window itself is unchanged; the v2 design's
// "Musim Candat 2026" hero copy and its 3 Oct default date are placeholders
// (October is outside the season and stays closed).

export type SeasonMonth = {
  /** Malay month name shown in the UI */
  name: string;
  /** JS month index (0 = January) */
  m: number;
  /** calendar year this entry belongs to */
  year: number;
  days: number;
};

const MONTH_WINDOW: Array<{ name: string; m: number; days: number }> = [
  { name: "Mac", m: 2, days: 31 },
  { name: "April", m: 3, days: 30 },
  { name: "Mei", m: 4, days: 31 },
  { name: "Jun", m: 5, days: 30 },
  { name: "Julai", m: 6, days: 31 },
  { name: "Ogos", m: 7, days: 31 },
  { name: "September", m: 8, days: 30 },
];

export const SEASON_YEARS = [2026, 2027] as const;

/** Mac 2026 → September 2027, in order. Indices into this array are used as
 *  the calendar's month cursor and as the HOLIDAYS key. */
export const MONTHS: SeasonMonth[] = SEASON_YEARS.flatMap((year) =>
  MONTH_WINDOW.map((m) => ({ ...m, year }))
);

export type Holiday = { d: number; n: string };

/** Keyed by index into MONTHS.
 *
 *  2026 (indices 0–6) is deliberately empty: every 2026 month except the last
 *  is already in the past by launch, and the only sellable window left
 *  (18–30 Sep 2026) contains no public holiday — Hari Malaysia on the 16th
 *  falls before it. Holiday chips on past, unbookable months are cosmetic
 *  only, so no dates are invented here.
 *
 *  2027 (indices 7–13) is copied verbatim from the design files' own
 *  HOLIDAYS constant. */
export const HOLIDAYS: Record<number, Holiday[]> = {
  7: [
    { d: 9, n: "Hari Raya Aidilfitri" },
    { d: 10, n: "Hari Raya Aidilfitri" },
  ],
  9: [
    { d: 1, n: "Hari Pekerja" },
    { d: 17, n: "Hari Raya Aidiladha" },
    { d: 20, n: "Hari Wesak" },
  ],
  10: [
    { d: 7, n: "Keputeraan Agong" },
    { d: 29, n: "Awal Muharram" },
  ],
  12: [{ d: 31, n: "Hari Kebangsaan" }],
  13: [
    { d: 6, n: "Maulidur Rasul" },
    { d: 16, n: "Hari Malaysia" },
  ],
};

/** Monday-first, matching the design's dowLabels. */
export const DOW_LABELS = ["ISN", "SEL", "RAB", "KHA", "JUM", "SAB", "AHD"];

/** Group-size chips above the calendar, and the search control's options.
 *  v2 opens the floor to 4 pax (v1 was 6). */
export const PAX_CHIPS = [4, 6, 8, 10, 12, 15];
export const PAX_OPTIONS = [4, 6, 8, 10, 12, 15];

export function isoDate(monthIdx: number, day: number): string {
  const m = MONTHS[monthIdx];
  return `${m.year}-${String(m.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(monthIdx: number): string {
  const m = MONTHS[monthIdx];
  return `${m.name} ${m.year}`;
}

/** First month index not entirely in the past — where the calendar opens, so
 *  nobody lands on a month of dead nights. Falls back to the last month once
 *  the whole window has passed. */
export function currentMonthIdx(today: string): number {
  const idx = MONTHS.findIndex(
    (m) => `${m.year}-${String(m.m + 1).padStart(2, "0")}` >= today.slice(0, 7)
  );
  return idx === -1 ? MONTHS.length - 1 : idx;
}

/** Formats an ISO date as e.g. "17 Mac 2027". */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTH_WINDOW.find((x) => x.m === m - 1);
  return `${d} ${month ? month.name : m} ${y}`;
}
