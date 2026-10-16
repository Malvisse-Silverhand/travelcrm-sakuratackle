import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ManageBooking from "@/components/public/book/ManageBooking";
import pub from "@/app/public.module.css";
import styles from "@/components/public/book/book.module.css";

export const metadata: Metadata = {
  title: "Manage My Booking | SAKURA TACKLE",
  robots: { index: false },
};

export default async function MyBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 20) : "";
  const supabase = await createClient();
  const { data: org } = await supabase.from("org_settings").select("whatsapp_number").eq("id", 1).maybeSingle();

  return (
    <div className={pub.shell}>
      <header className={pub.header}>
        <div className={pub.headerInner}>
          <Link href="/" className={pub.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.webp" alt="Sakura Tackle" width={34} height={34} className={pub.logoMark} />
            <span className={pub.brandText}>
              <span className={pub.brandName}>SAKURA TACKLE</span>
              <span className={pub.brandSub}>Trip Candat Sotong</span>
            </span>
          </Link>
          <div className={pub.headerRight}>
            <Link href="/#tempah" className={pub.headerCta}>
              Book a Boat
            </Link>
          </div>
        </div>
      </header>
      <main className={styles.manage}>
        <ManageBooking initialRef={ref} waNumber={org?.whatsapp_number ?? "601153598055"} />
      </main>
    </div>
  );
}
