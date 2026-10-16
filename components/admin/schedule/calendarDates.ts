// Date ranges for the booking calendar views. Dates are YYYY-MM-DD strings
// handled as UTC-anchored calendar days (see lib/date.ts).

import { addDaysISO } from "@/lib/date";

export type ScheduleView = "day" | "week" | "month" | "year";
export const VIEWS: ScheduleView[] = ["day", "week", "month", "year"];

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIdx(day: string): number {
  const [y, m, d] = parts(day);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function weekStart(day: string): string {
  return addDaysISO(day, -weekdayIdx(day));
}

export function monthStart(day: string): string {
  const [y, m] = parts(day);
  return iso(y, m, 1);
}

export function monthEnd(day: string): string {
  const [y, m] = parts(day);
  return iso(y, m + 1, 0);
}

export function addMonths(day: string, n: number): string {
  const [y, m, d] = parts(day);
  // Clamp to the target month's last day (31 Jan + 1 month = 28/29 Feb).
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return iso(y, m + n, Math.min(d, last));
}

/** The nights a view covers, inclusive. */
export function rangeFor(view: ScheduleView, day: string): { from: string; to: string } {
  const [y] = parts(day);
  switch (view) {
    case "day":
      return { from: day, to: day };
    case "week": {
      const from = weekStart(day);
      return { from, to: addDaysISO(from, 6) };
    }
    case "month":
      // Whole weeks, so the grid has no gaps.
      return {
        from: weekStart(monthStart(day)),
        to: addDaysISO(weekStart(monthEnd(day)), 6),
      };
    case "year":
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
  }
}

export function stepDate(view: ScheduleView, day: string, dir: 1 | -1): string {
  switch (view) {
    case "day":
      return addDaysISO(day, dir);
    case "week":
      return addDaysISO(day, 7 * dir);
    case "month":
      return addMonths(day, dir);
    case "year":
      return addMonths(day, 12 * dir);
  }
}

/** e.g. "Fri 16 Oct 2026" */
export function dayLabel(day: string, withYear = true): string {
  const [y, m, d] = parts(day);
  return `${WEEKDAYS_EN[weekdayIdx(day)]} ${d} ${MONTHS_EN[m - 1].slice(0, 3)}${withYear ? ` ${y}` : ""}`;
}

export function titleFor(view: ScheduleView, day: string): string {
  const [y, m] = parts(day);
  switch (view) {
    case "day":
      return dayLabel(day);
    case "week": {
      const from = weekStart(day);
      return `${dayLabel(from, false)} – ${dayLabel(addDaysISO(from, 6))}`;
    }
    case "month":
      return `${MONTHS_EN[m - 1]} ${y}`;
    case "year":
      return String(y);
  }
}

export function dayOfMonth(day: string): number {
  return parts(day)[2];
}

export function monthOf(day: string): number {
  return parts(day)[1];
}

export function isISODate(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
