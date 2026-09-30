import "server-only";
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
 *  everything a page needs to render the booking calendar and form. */
export async function loadBookingData() {
  const supabase = await createClient();

  // The season spans Mac 2026 → Sep 2027, so index 0 is a month already in the
  // past. Open on the first month that still has sellable nights.
  const openMonthIdx = currentMonthIdx(todayISO());

  const [{ data: pkg }, { data: org }, { data: availability }] = await Promise.all([
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

  return {
    openMonthIdx,
    pkg,
    org,
    availability: (availability ?? []) as Availability[],
  };
}
