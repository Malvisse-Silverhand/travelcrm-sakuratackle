import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { Faq } from "@/components/public/FaqAccordion";
import {
  FALLBACK_SEASON,
  monthFirstISO,
  monthKey,
  monthLastISO,
  monthsBetween,
  type SeasonMonth,
} from "@/lib/season";
import { todayISO } from "@/lib/date";

/** One night of the season-wide availability, as get_public_availability
 *  returns it. Only used here now, to work out which months are on sale. */
export type Availability = {
  night_date: string;
  status: "open" | "selling_fast" | "full" | "blocked";
  suggested_boat_id: string | null;
  suggested_boat_code: string | null;
};

/** Group size the booking section opens on — matches the design's default. */
export const DEFAULT_PAX = 8;

/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;

export type PackageRow = {
  id: string;
  title: string;
  subtitle: string | null;
  price_per_pax: number;
  deposit_per_boat: number;
  includes: string[];
  faqs: Faq[];
  season_start: string | null;
  season_end: string | null;
};

export type OrgSettings = {
  business_name: string;
  location: string;
  whatsapp_number: string;
};

/** The published package, org settings, the months on sale and the opening
 *  month's availability: everything a page needs to render the booking flow.
 *
 *  Months on sale are derived, not hardcoded: every month inside the
 *  package's season (set in Settings) that still has at least one future trip
 *  night. A winter gap inside a two-year season has no trip nights, so it
 *  drops out on its own, and so do months already past.
 *
 *  `unavailable` separates "the database could not be reached" from "no
 *  package is published". They used to look identical: when the free-tier
 *  Supabase project auto-paused, every page told customers "Trip belum dibuka"
 *  for twelve days and nothing alerted anyone. A failed read is now reported
 *  to Sentry, which emails on a new issue, and the page says the booking
 *  system is down rather than that the season is closed. */
export async function loadBookingData() {
  const supabase = await createClient();
  const today = todayISO();

  const [pkgRes, orgRes] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id,title,subtitle,price_per_pax,deposit_per_boat,includes,faqs,season_start,season_end"
      )
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle<PackageRow>(),
    supabase
      .from("org_settings")
      .select("business_name,location,whatsapp_number")
      .eq("id", 1)
      .maybeSingle<OrgSettings>(),
  ]);

  // The package read is the one the page cannot work without, so it decides
  // whether the booking system counts as down.
  let unavailable = Boolean(pkgRes.error);
  if (pkgRes.error) report("package", pkgRes.error);

  const pkg = pkgRes.data;
  let months: SeasonMonth[] = [];
  let availability: Availability[] = [];

  if (pkg) {
    const seasonStart = pkg.season_start ?? FALLBACK_SEASON.start;
    const seasonEnd = pkg.season_end ?? FALLBACK_SEASON.end;
    const from = seasonStart > today ? seasonStart : today;

    if (from <= seasonEnd) {
      // One row per night that has trip_nights rows, paged past the
      // PostgREST row cap so a long season is never silently cut short.
      const rows: Availability[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase
          .rpc("get_public_availability", { p_from: from, p_to: seasonEnd, p_pax: DEFAULT_PAX })
          .range(offset, offset + PAGE - 1);
        if (error) {
          report("availability", error);
          unavailable = true;
          break;
        }
        rows.push(...((data ?? []) as Availability[]));
        if (!data || data.length < PAGE) break;
      }

      const onSale = new Set(rows.map((r) => r.night_date.slice(0, 7)));
      months = monthsBetween(from, seasonEnd).filter((m) => onSale.has(monthKey(m)));

      // Only the opening month goes to the browser; the calendar fetches the
      // others as the visitor pages to them.
      const first = months[0];
      if (first) {
        const lo = monthFirstISO(first);
        const hi = monthLastISO(first);
        availability = rows.filter((r) => r.night_date >= lo && r.night_date <= hi);
      }
    }
  }

  return { pkg, org: orgRes.data, months, availability, unavailable };
}

function report(what: string, error: { message: string; code?: string; details?: string }) {
  Sentry.captureException(new Error(`Booking data unreachable (${what}): ${error.message}`), {
    tags: { area: "public-booking" },
    extra: { code: error.code, details: error.details },
  });
}
