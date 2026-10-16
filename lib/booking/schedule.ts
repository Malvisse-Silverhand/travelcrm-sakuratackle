// Booking calendar data: one cell per boat per night, shared by the dashboard
// strip and /admin/schedule. Cells are derived from bookings and blocked
// trip_nights, never stored.

import type { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Display status of one boat on one night, most urgent first. */
export type CellStatus =
  | "blocked"
  | "weather"
  | "deposit_due"
  | "full"
  | "confirmed"
  | "pending"
  | "open"
  | "off";

export const CELL_LABEL: Record<CellStatus, string> = {
  blocked: "Blocked",
  weather: "Weather hold",
  deposit_due: "Deposit due",
  full: "Full",
  confirmed: "Confirmed",
  pending: "Pending",
  open: "Open",
  off: "Off season",
};

/** Legend order. */
export const CELL_ORDER: CellStatus[] = [
  "open",
  "pending",
  "deposit_due",
  "confirmed",
  "full",
  "weather",
  "blocked",
  "off",
];

export type ScheduleBoat = {
  id: string;
  code: string;
  capacity: number;
  jettyId: string;
  jettyName: string;
  vendorId: string | null;
  vendorName: string;
};

export type ScheduleBooking = {
  id: string;
  ref: string;
  full_name: string;
  pax: number;
  status: string;
  pricing: string;
  night_date: string;
  boat_id: string;
  total_amount: number;
};

export type Cell = {
  status: CellStatus;
  /** Pax on live bookings (pending, deposit due, confirmed, weather hold). */
  pax: number;
  capacity: number;
  bookings: ScheduleBooking[];
  blockedReason: string | null;
};

export type Season = { start: string; end: string };

export type ScheduleData = {
  bookings: Map<string, ScheduleBooking[]>;
  blocked: Map<string, string | null>;
};

const LIVE = ["pending", "deposit_due", "confirmed", "weather_hold"];
const PAGE = 1000;

export function cellKey(boatId: string, night: string): string {
  return `${boatId}|${night}`;
}

/** Live bookings and blocked nights for the boats over [from, to]. Pages
 *  through results, since a year of bookings can pass PostgREST's row cap. */
export async function loadSchedule(
  supabase: Supabase,
  boatIds: string[],
  from: string,
  to: string
): Promise<ScheduleData> {
  const bookings = new Map<string, ScheduleBooking[]>();
  const blocked = new Map<string, string | null>();
  if (boatIds.length === 0) return { bookings, blocked };

  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from("bookings")
      .select("id, ref, full_name, pax, status, pricing, night_date, boat_id, total_amount")
      .in("boat_id", boatIds)
      .in("status", LIVE)
      .gte("night_date", from)
      .lte("night_date", to)
      .order("night_date")
      .order("created_at")
      .range(offset, offset + PAGE - 1);
    for (const b of (data ?? []) as ScheduleBooking[]) {
      const k = cellKey(b.boat_id, b.night_date);
      const list = bookings.get(k);
      if (list) list.push(b);
      else bookings.set(k, [b]);
    }
    if (!data || data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from("trip_nights")
      .select("boat_id, night_date, blocked_reason")
      .in("boat_id", boatIds)
      .eq("blocked", true)
      .gte("night_date", from)
      .lte("night_date", to)
      .range(offset, offset + PAGE - 1);
    for (const t of data ?? []) blocked.set(cellKey(t.boat_id, t.night_date), t.blocked_reason);
    if (!data || data.length < PAGE) break;
  }

  return { bookings, blocked };
}

export function cellFor(
  data: ScheduleData,
  boat: ScheduleBoat,
  night: string,
  season: Season
): Cell {
  const k = cellKey(boat.id, night);
  const bookings = data.bookings.get(k) ?? [];
  const isBlocked = data.blocked.has(k);
  const pax = bookings.reduce((n, b) => n + b.pax, 0);
  const has = (s: string) => bookings.some((b) => b.status === s);
  const taken =
    pax >= boat.capacity ||
    bookings.some((b) => b.pricing === "charter" && b.status !== "pending");

  let status: CellStatus;
  if (isBlocked) status = "blocked";
  else if (has("weather_hold")) status = "weather";
  else if (has("deposit_due")) status = "deposit_due";
  else if (has("confirmed")) status = taken ? "full" : "confirmed";
  else if (has("pending")) status = "pending";
  else if (night < season.start || night > season.end) status = "off";
  else status = "open";

  return {
    status,
    pax,
    capacity: boat.capacity,
    bookings,
    blockedReason: isBlocked ? data.blocked.get(k) ?? null : null,
  };
}

/** Every night from `from` to `to`, inclusive. */
export function nightsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Active boats the viewer may see, with their jetty and vendor names.
 *  Vendors see only their own boats. */
export async function loadScheduleBoats(
  supabase: Supabase,
  viewer: { role: string; userId: string }
): Promise<ScheduleBoat[]> {
  const isVendor = viewer.role === "vendor";
  const boatsQuery = supabase
    .from("boats")
    .select("id, code, capacity, jetty_id, vendor_id, jetties(name)")
    .eq("active", true)
    .order("sort_order")
    .order("code");
  const [{ data: boats }, { data: vendors }] = await Promise.all([
    isVendor ? boatsQuery.eq("vendor_id", viewer.userId) : boatsQuery,
    isVendor
      ? Promise.resolve({ data: [] as { id: string; full_name: string }[] })
      : supabase.from("profiles").select("id, full_name").eq("role", "vendor"),
  ]);
  const vendorName = new Map((vendors ?? []).map((v) => [v.id as string, v.full_name as string]));

  return (boats ?? []).map((b) => {
    const j = Array.isArray(b.jetties) ? b.jetties[0] : b.jetties;
    return {
      id: b.id,
      code: b.code,
      capacity: b.capacity,
      jettyId: b.jetty_id,
      jettyName: (j as { name?: string } | null)?.name ?? b.jetty_id,
      vendorId: b.vendor_id,
      vendorName: b.vendor_id
        ? vendorName.get(b.vendor_id) ?? (isVendor ? "You" : "Vendor")
        : "Sakura Tackle",
    };
  });
}

/** The published package's season, used to tell open nights from off-season. */
export async function loadSeason(supabase: Supabase, fallback: Season): Promise<Season> {
  const { data } = await supabase
    .from("packages")
    .select("season_start, season_end")
    .eq("published", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return {
    start: data?.season_start ?? fallback.start,
    end: data?.season_end ?? fallback.end,
  };
}
