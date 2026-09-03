// Season + holiday constants, copied from the HOLIDAYS / MONTHS constants in
// design-reference/Laman Tempahan.dc.html. Hardcoded on purpose — §8 of the
// build prompt rules out a public-holiday API integration for this phase.

export const SEASON_YEAR = 2027;

export type SeasonMonth = {
  /** Malay month name shown in the UI */
  name: string;
  /** JS month index (0 = January) */
  m: number;
  days: number;
};

export const MONTHS: SeasonMonth[] = [
  { name: "Mac", m: 2, days: 31 },
  { name: "April", m: 3, days: 30 },
  { name: "Mei", m: 4, days: 31 },
  { name: "Jun", m: 5, days: 30 },
  { name: "Julai", m: 6, days: 31 },
  { name: "Ogos", m: 7, days: 31 },
  { name: "September", m: 8, days: 30 },
];

export type Holiday = { d: number; n: string };

/** Keyed by index into MONTHS, matching the design file's own HOLIDAYS shape. */
export const HOLIDAYS: Record<number, Holiday[]> = {
  0: [
    { d: 9, n: "Hari Raya Aidilfitri" },
    { d: 10, n: "Hari Raya Aidilfitri" },
  ],
  1: [],
  2: [
    { d: 1, n: "Hari Pekerja" },
    { d: 17, n: "Hari Raya Aidiladha" },
    { d: 20, n: "Hari Wesak" },
  ],
  3: [
    { d: 7, n: "Keputeraan Agong" },
    { d: 29, n: "Awal Muharram" },
  ],
  4: [],
  5: [{ d: 31, n: "Hari Kebangsaan" }],
  6: [
    { d: 6, n: "Maulidur Rasul" },
    { d: 16, n: "Hari Malaysia" },
  ],
};

/** Monday-first, matching the design's dowLabels. */
export const DOW_LABELS = ["ISN", "SEL", "RAB", "KHA", "JUM", "SAB", "AHD"];

/** Group-size chips above the calendar (CAPACITY in the design file). */
export const PAX_CHIPS = [6, 8, 10, 12, 14];

/** Options in the booking form's pax dropdown.
 *  The design file lists [4,5,6,...] here, but both its own pax chips and its
 *  pricing copy ("seorang, minimum 6 pax") say the minimum is 6 — offering 4
 *  and 5 would let someone book below the stated minimum, so they're dropped. */
export const PAX_OPTIONS = [6, 7, 8, 9, 10, 12, 14];

export function isoDate(monthIdx: number, day: number): string {
  const m = MONTHS[monthIdx];
  return `${SEASON_YEAR}-${String(m.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(monthIdx: number): string {
  return `${MONTHS[monthIdx].name} ${SEASON_YEAR}`;
}

/** Formats an ISO date as e.g. "17 Mac 2027". */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS.find((x) => x.m === m - 1);
  return `${d} ${month ? month.name : m} ${y}`;
}
