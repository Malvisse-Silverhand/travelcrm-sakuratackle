import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type { Availability } from "@/components/public/BookingExperience";
import type { Faq } from "@/components/public/FaqAccordion";
import { MONTHS, currentMonthIdx, isoDate } from "@/lib/season";
import { todayISO } from "@/lib/date";

/** Group size the booking section opens on — matches the design's default. */
export const DEFAULT_PAX = 8;

export type PackageRow = {
  id: string;
  title: string;
  subtitle: string | null;
  price_per_pax: number;
  deposit_per_boat: number;
  includes: string[];
  faqs: Faq[];
};

export type OrgSettings = {
  business_name: string;
  location: string;
  whatsapp_number: string;
};

/** The published package, org settings and the opening month's availability:
 *  everything a page needs to render the booking calendar and form.
 *
 *  `unavailable` separates "the database could not be reached" from "no
 *  package is published". They used to look identical: when the free-tier
 *  Supabase project auto-paused, every page told customers "Trip belum dibuka"
 *  for twelve days and nothing alerted anyone. A failed read is now reported
 *  to Sentry, which emails on a new issue, and the page says the booking
 *  system is down rather than that the season is closed. */
export async function loadBookingData() {
  const supabase = await createClient();

  // The season spans Mac 2026 → Sep 2027, so index 0 is a month already in the
  // past. Open on the first month that still has sellable nights.
  const openMonthIdx = currentMonthIdx(todayISO());

  const [pkgRes, orgRes, availRes] = await Promise.all([
    supabase
      .from("packages")
      .select("id,title,subtitle,price_per_pax,deposit_per_boat,includes,faqs")
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle<PackageRow>(),
    supabase
      .from("org_settings")
      .select("business_name,location,whatsapp_number")
      .eq("id", 1)
      .maybeSingle<OrgSettings>(),
    supabase.rpc("get_public_availability", {
      p_from: isoDate(openMonthIdx, 1),
      p_to: isoDate(openMonthIdx, MONTHS[openMonthIdx].days),
      p_pax: DEFAULT_PAX,
    }),
  ]);

  // The package read is the one the page cannot work without, so it decides
  // whether the booking system counts as down.
  const unavailable = Boolean(pkgRes.error);
  if (pkgRes.error) {
    Sentry.captureException(new Error(`Booking data unreachable: ${pkgRes.error.message}`), {
      tags: { area: "public-booking" },
      extra: { code: pkgRes.error.code, details: pkgRes.error.details },
    });
  }

  return {
    openMonthIdx,
    pkg: pkgRes.data,
    org: orgRes.data,
    availability: (availRes.data ?? []) as Availability[],
    unavailable,
  };
}
