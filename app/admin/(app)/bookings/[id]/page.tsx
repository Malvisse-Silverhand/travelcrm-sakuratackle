import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BookingDetailActions from "@/components/admin/BookingDetailActions";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../../admin.module.css";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  deposit_due: "Deposit due",
  weather_hold: "Weather hold",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending: styles.statusPending,
  confirmed: styles.statusConfirmed,
  deposit_due: styles.statusDepositDue,
  weather_hold: styles.statusWeatherHold,
  cancelled: styles.statusCancelled,
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: booking }, { data: paxList }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, email, pax, note, status, night_date, price_per_pax, deposit_amount, deposit_paid, deposit_paid_at, receipt_url, created_at, boats(code, skipper_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("booking_pax")
      .select("id, full_name")
      .eq("booking_id", id)
      .order("sort_order"),
  ]);

  if (!booking) notFound();

  const boat = Array.isArray(booking.boats) ? booking.boats[0] : booking.boats;
  const totalAmount = booking.pax * Number(booking.price_per_pax);
  const balanceDue = totalAmount - (booking.deposit_paid ? Number(booking.deposit_amount) : 0);
  const bookedDate = formatLongDate(booking.created_at.slice(0, 10));

  return (
    <>
      <PageHeader title="Booking" subtitle={booking.ref} avatarInitials={profile.initials} />
      <div className={styles.main}>
        <Link href="/admin/bookings" className={styles.backLink}>
          &#8592; All bookings
        </Link>

        <div className={styles.detailGrid}>
          <div>
            <div className={styles.detailCard}>
              <div className={styles.detailCardHead}>
                <span className={styles.detailName}>{booking.full_name}</span>
                <span className={`${styles.manifestStatus} ${STATUS_CLASS[booking.status] ?? ""}`}>
                  {STATUS_LABEL[booking.status] ?? booking.status}
                </span>
              </div>
              <div className={styles.detailRefLine}>
                {booking.ref} &#183; booked {bookedDate}
              </div>
              <div className={styles.detailStatsGrid}>
                <div>
                  <span className={styles.detailStatLabel}>Boat</span>
                  <span className={styles.detailStatValue}>{boat?.code ?? "?"}</span>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Night</span>
                  <span className={styles.detailStatValue}>
                    {formatLongDate(booking.night_date)}
                  </span>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Phone</span>
                  <span className={styles.detailStatValue}>{booking.phone}</span>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Email</span>
                  <span className={styles.detailStatValue}>{booking.email ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Pax list ({booking.pax})</span>
              {paxList && paxList.length > 0 ? (
                <div className={styles.paxGrid}>
                  {paxList.map((p) => (
                    <span key={p.id} className={styles.paxName}>
                      {p.full_name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyCardBody}>Tiada senarai nama direkodkan setakat ini.</p>
              )}
            </div>

            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Skipper note</span>
              <p className={styles.skipperNote}>{booking.note ?? "Tiada nota."}</p>
            </div>
          </div>

          <BookingDetailActions
            booking={{
              id: booking.id,
              ref: booking.ref,
              fullName: booking.full_name,
              phone: booking.phone,
              status: booking.status,
              nightDate: booking.night_date,
              boatCode: boat?.code ?? "?",
              pax: booking.pax,
              totalAmount,
              balanceDue,
              depositAmount: Number(booking.deposit_amount),
              depositPaid: booking.deposit_paid,
              depositPaidAt: booking.deposit_paid_at,
              receiptUrl: booking.receipt_url,
            }}
          />
        </div>
      </div>
    </>
  );
}
