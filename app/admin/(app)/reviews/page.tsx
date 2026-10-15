import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import ReviewsTable, { type ReviewRow } from "@/components/admin/ReviewsTable";
import styles from "../../admin.module.css";

export default async function ReviewsPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, name, rating, comment, status, created_at, booking_id, bookings(ref, night_date), boats(code)")
    .order("created_at", { ascending: false });

  const rows: ReviewRow[] = (data ?? []).map((r) => {
    const bk = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings;
    const bt = Array.isArray(r.boats) ? r.boats[0] : r.boats;
    return {
      id: r.id,
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      created_at: r.created_at,
      booking_id: r.booking_id,
      ref: bk?.ref ?? "?",
      trip_date: bk?.night_date ?? r.created_at.slice(0, 10),
      boat: bt?.code ?? "—",
    };
  });
  const published = rows.filter((r) => r.status === "published");
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle={
          published.length
            ? `${avg.toFixed(1)}★ from ${published.length} published review${published.length === 1 ? "" : "s"}`
            : "Customer reviews after their trip"
        }
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <ReviewsTable rows={rows} />
      </div>
    </>
  );
}
