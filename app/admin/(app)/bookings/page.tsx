import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BookingsList, { type BookingListRow } from "@/components/admin/BookingsList";
import BookingBoard, { type BoardRow } from "@/components/admin/board/BookingBoard";
import boardStyles from "@/components/admin/board/board.module.css";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const board = view === "board";
  const profile = await requireStaff();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const today = todayISO();
  const [{ data: bookings }, { data: boats }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, receipt_url, source, balance_paid, trip_outcome, refund_amount, refunded_at, boat_id, created_at, deposit_paid_at, boats(code), reviews(rating)"
      )
      .order("night_date", { ascending: false }),
    supabase.from("boats").select("id, code, capacity").eq("active", true).order("sort_order").order("code"),
  ]);

  // Upcoming trips soonest first, then past trips newest first.
  const all = ((bookings ?? []) as unknown as Array<BookingListRow & { created_at: string; deposit_paid_at: string | null; reviews: { rating: number } | { rating: number }[] | null }>).map((b) => {
    const rv = Array.isArray(b.reviews) ? b.reviews[0] : b.reviews;
    return { ...b, review_rating: rv?.rating ?? null } as BoardRow;
  });
  const rows = [
    ...all.filter((b) => b.night_date >= today).sort((a, b) => a.night_date.localeCompare(b.night_date)),
    ...all.filter((b) => b.night_date < today),
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle={`${rows.length} booking${rows.length === 1 ? "" : "s"}`}
        avatarInitials={profile.initials}
        actions={
          <>
            <span className={boardStyles.viewToggle}>
              <Link href="/admin/bookings" className={board ? "" : boardStyles.viewOn} aria-current={board ? undefined : "page"}>
                List
              </Link>
              <Link href="/admin/bookings?view=board" className={board ? boardStyles.viewOn : ""} aria-current={board ? "page" : undefined}>
                Board
              </Link>
            </span>
            <Link href="/admin/bookings/new" className={styles.headerActionBtn}>
              New booking
            </Link>
          </>
        }
      />
      <div className={styles.main}>
        {board ? (
          <BookingBoard rows={rows} boats={boats ?? []} today={today} />
        ) : (
          <BookingsList rows={rows} boats={boats ?? []} today={today} />
        )}
      </div>
    </>
  );
}
