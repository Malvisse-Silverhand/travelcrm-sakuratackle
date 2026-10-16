import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { summarise, type PublicReview } from "@/lib/booking/reviews";
import { formatLongDate } from "@/lib/season";
import pub from "@/app/public.module.css";
import styles from "@/app/polisi/polisi.module.css";
import book from "@/components/public/book/book.module.css";

export const metadata: Metadata = {
  title: "Customer Reviews | SAKURA TACKLE",
  description: "Ulasan pelanggan trip candat sotong Sakura Tackle di Jeti Marang, Terengganu.",
};

/** Every published review, newest first. Reviews come from customers after
 *  their trip and are approved by an admin before they appear here. */
export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_published_reviews");
  const reviews = (data ?? []) as PublicReview[];
  const { overall } = summarise(reviews);

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
      <main className={`${pub.container} ${styles.page}`}>
        <span className={pub.eyebrow}>Ulasan Pelanggan</span>
        <h1 className={styles.title}>Customer Reviews</h1>
        {overall ? (
          <p className={styles.updated}>
            <span className={book.stars}>★</span> {overall.avg.toFixed(1)} daripada 5, {overall.count} ulasan
          </p>
        ) : (
          <p className={styles.updated}>Belum ada ulasan. Jadi yang pertama selepas trip anda!</p>
        )}

        {reviews.map((r) => (
          <section key={r.id} className={styles.section}>
            <p className={book.stars} aria-label={`${r.rating} of 5`} style={{ fontSize: 20 }}>
              {"★".repeat(r.rating)}
              <span>{"★".repeat(5 - r.rating)}</span>
            </p>
            {r.comment && <p>“{r.comment}”</p>}
            <p style={{ margin: 0, fontSize: 13 }}>
              <b>{r.name}</b>
              {r.boat_code ? ` · ${r.boat_code}` : ""} · {formatLongDate(r.trip_date)}
            </p>
          </section>
        ))}
      </main>
    </div>
  );
}
