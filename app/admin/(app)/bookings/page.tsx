import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BookingsList, { type BookingListRow } from "@/components/admin/BookingsList";
import styles from "../../admin.module.css";

export default async function BookingsPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, ref, full_name, status, night_date, pax, price_per_pax, boats(code)")
    .order("night_date");

  const rows = (bookings ?? []) as unknown as BookingListRow[];

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle={`${rows.length} tempahan`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <BookingsList rows={rows} />
      </div>
    </>
  );
}
