import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BookingDetailActions from "@/components/admin/BookingDetailActions";
import { formatLongDate } from "@/lib/season";
import { customerKey } from "@/lib/admin/customers";
import { formatRM } from "@/lib/date";
import { balanceDue as balanceDueOf, bookingTotal, payPlanLabel, upfrontAmount } from "@/lib/booking/amounts";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import styles from "../../../admin.module.css";

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
        "id, ref, full_name, phone, email, pax, note, status, night_date, pricing, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, deposit_paid_at, receipt_url, created_at, boats(code, skipper_name)"
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
  const totalAmount = bookingTotal(booking);
  const balanceDue = balanceDueOf(booking);
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
                <span className={statusPill(booking.status)}>
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
                  <Link
                    href={`/admin/customers/${customerKey(booking.phone)}`}
                    className={styles.detailStatValue}
                  >
                    {booking.phone} &#8599;
                  </Link>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Email</span>
                  <span className={styles.detailStatValue}>{booking.email ?? "—"}</span>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Pricing</span>
                  <span className={styles.detailStatValue}>
                    {booking.pricing === "charter"
                      ? `Whole-boat charter, ${formatRM(totalAmount)}`
                      : `${booking.pax} pax × ${formatRM(Number(booking.price_per_pax))}`}
                  </span>
                </div>
                <div>
                  <span className={styles.detailStatLabel}>Payment plan</span>
                  <span className={styles.detailStatValue}>
                    {payPlanLabel(booking.pay_plan)}, {formatRM(upfrontAmount(booking))} up front
                  </span>
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

          {/* Vendors read their boats' bookings; money and cancellation stay
              with the admins (RLS would refuse those writes anyway). */}
          {profile.role === "vendor" ? (
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Payment</span>
              <p className={styles.emptyCardBody}>
                Deposits, receipts and cancellations are handled by Sakura Tackle&apos;s admins.
              </p>
            </div>
          ) : (
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
                depositAmount: upfrontAmount(booking),
                depositPaid: booking.deposit_paid,
                depositPaidAt: booking.deposit_paid_at,
                receiptUrl: booking.receipt_url,
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
