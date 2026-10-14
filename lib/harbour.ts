// Harbour HQ timing: when the boats board, sail, fish and come home, on the
// operator's real clock (Malaysia time). Pure functions — the 3D scene and
// the dashboard both read them.
//
// One trip cycle runs from 07:30 (last night's boats are back) to 07:30 the
// next day. A trip "night" is the date the boats leave on.

export const CYCLE_START = 7 * 60 + 30; // 07:30
export const BOARD = 15 * 60 + 30; // crew gathers on deck
export const DEPART = 16 * 60 + 45; // after Asar
export const AT_SEA = 18 * 60; // at the lubuk
export const HEAD_HOME = 6 * 60;
export const DOCKED = 7 * 60 + 15;
/** Each berth casts off a few minutes after the one before it. */
export const STAGGER = 6;

export type BoatPhase = "docked" | "boarding" | "outbound" | "fishing" | "inbound";

/** Minutes since midnight, Malaysia time. */
export function myMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute") + get("second") / 60;
}

/** Position in the cycle (0 = 07:30, 1440 = 07:30 next day) of a clock time. */
export function toCycle(minutes: number): number {
  return (((minutes - CYCLE_START) % 1440) + 1440) % 1440;
}

export function fromCycle(cycle: number): number {
  return (cycle + CYCLE_START) % 1440;
}

/** The trip night the harbour is showing at `minutes` on `todayISO`:
 *  before 07:30 it is still last night's trip. */
export function tripNightISO(todayISO: string, minutes: number): string {
  if (minutes >= CYCLE_START) return todayISO;
  const d = new Date(`${todayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function clockLabel(minutes: number): string {
  const m = Math.floor(((minutes % 1440) + 1440) % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Where a sailing boat is in its trip: phase, and progress along the
 *  outbound path (0 = berth, 1 = fishing spot). `berth` staggers departure. */
export function sailingState(cycle: number, berth: number): { phase: BoatPhase; s: number } {
  const lag = berth * STAGGER;
  const c = cycle - lag;
  const board = toCycle(BOARD);
  const depart = toCycle(DEPART);
  const atSea = toCycle(AT_SEA);
  const home = toCycle(HEAD_HOME);
  const docked = toCycle(DOCKED);
  if (c < board) return { phase: "docked", s: 0 };
  if (c < depart) return { phase: "boarding", s: 0 };
  if (c < atSea) return { phase: "outbound", s: smooth(clamp01((c - depart) / (atSea - depart))) };
  if (c < home) return { phase: "fishing", s: 1 };
  if (c < docked) return { phase: "inbound", s: 1 - smooth(clamp01((c - home) / (docked - home))) };
  return { phase: "docked", s: 0 };
}

/** 0 = full day, 1 = full night, easing through dusk and dawn. */
export function nightBlend(minutes: number): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  const dusk = smooth(clamp01((m - 18 * 60) / 105)); // 18:00 → 19:45
  const dawn = smooth(clamp01((m - (5 * 60 + 30)) / 90)); // 05:30 → 07:00
  if (m >= 12 * 60) return dusk;
  return 1 - dawn;
}

/** Lamps come on once it is properly dark and the boat is at the lubuk. */
export function lampLevel(phase: BoatPhase, minutes: number): number {
  if (phase !== "fishing" && phase !== "inbound" && phase !== "outbound") return 0;
  return clamp01((nightBlend(minutes) - 0.4) / 0.6);
}

export function phaseLabel(phase: BoatPhase): string {
  switch (phase) {
    case "boarding":
      return "Boarding";
    case "outbound":
      return "Heading out";
    case "fishing":
      return "At the lubuk";
    case "inbound":
      return "Heading home";
    default:
      return "At the jetty";
  }
}
