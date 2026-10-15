import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBookingData } from "@/lib/booking/publicData";
import BookingNotice from "@/components/public/BookingNotice";
import Checkout, { type BoatNight } from "@/components/public/book/Checkout";
import type { FleetBoat } from "@/components/public/home/FleetShowcase";
import { monthFirstISO, monthLastISO } from "@/lib/season";
import { JETTY_SELECT, type Jetty } from "@/lib/content/booking";
import { waLink, waUnavailable } from "@/lib/whatsapp";
import pub from "@/app/public.module.css";

export const metadata: Metadata = {
  title: "Book Your Boat | Sakura Tackle",
  description: "Pilih tarikh, isi butiran dan lock bot candat sotong anda di Terengganu.",
};

/** Checkout for one boat: date, details, payment, done. The homepage search
 *  links here with ?boat=<id>&pax=<n>. */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const boatId = typeof sp.boat === "string" ? sp.boat : "";
  const paxParam = Number(typeof sp.pax === "string" ? sp.pax : NaN);

  // A malformed id would make Postgres raise rather than return nothing.
  if (!/^[0-9a-f-]{36}$/i.test(boatId)) redirect("/#tempah");

  const supabase = await createClient();
  const [{ pkg, org, months, unavailable }, { data: boat }] = await Promise.all([
    loadBookingData(),
    supabase
      .from("boats")
      .select(
        "id,code,display_name,kind,length_ft,beam,material,capacity,daily_rate,description,photo_url,jetty_id"
      )
      .eq("id", boatId)
      .eq("active", true)
      .maybeSingle<FleetBoat>(),
  ]);

  const wa = org?.whatsapp_number ?? "601153598055";
  const waHref = waLink(wa, waUnavailable());

  if (!pkg) {
    return (
      <div className={pub.shell}>
        <BookingNotice kind={unavailable ? "down" : "closed"} waHref={waHref} />
      </div>
    );
  }
  if (!boat || !(Number(boat.daily_rate) > 0)) redirect("/#tempah");

  const { data: jetty } = await supabase
    .from("jetties")
    .select(JETTY_SELECT)
    .eq("id", boat.jetty_id)
    .maybeSingle<Jetty>();
  // A boat at a jetty that has not opened yet cannot be booked (the booking
  // function refuses it too); send the customer back to the search.
  if (!jetty?.open) redirect("/#tempah");

  // The boat's nights for the opening month; the calendar fetches the rest.
  let initial: BoatNight[] = [];
  if (months[0]) {
    const { data } = await supabase.rpc("get_boat_availability", {
      p_from: monthFirstISO(months[0]),
      p_to: monthLastISO(months[0]),
      p_boat_id: boat.id,
    });
    initial = (data ?? []) as BoatNight[];
  }

  const pax = Number.isFinite(paxParam) && paxParam >= 1 ? Math.min(paxParam, boat.capacity) : Math.min(8, boat.capacity);

  return (
    <div className={pub.shell}>
      <header className={pub.header}>
        <div className={pub.headerInner}>
          <Link href="/" className={pub.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-badge.webp" alt="Sakura Tackle" width={34} height={34} className={pub.logoMark} />
            <span className={pub.brandText}>
              <span className={pub.brandName}>SAKURA TACKLE</span>
              <span className={pub.brandSub}>Trip Candat Sotong</span>
            </span>
          </Link>
          <div className={pub.headerRight}>
            <Link href="/#tempah" className={pub.headerCta}>
              Change Boat
            </Link>
          </div>
        </div>
      </header>

      <Checkout
        packageId={pkg.id}
        boat={boat}
        jetty={jetty}
        depositPerBoat={Number(pkg.deposit_per_boat)}
        months={months}
        initialPax={pax}
        initialNights={initial}
        waNumber={wa}
      />
    </div>
  );
}
