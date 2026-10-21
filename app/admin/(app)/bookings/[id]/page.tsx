import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BookingDetailActions from "@/components/admin/BookingDetailActions";
import BookingRequests, { type RequestRow } from "@/components/admin/BookingRequests";
import { formatLongDate } from "@/lib/season";
import { customerKey } from "@/lib/admin/customers";
import { formatRM } from "@/lib/date";
import { bookingTotal, payPlanLabel, upfrontAmount } from "@/lib/booking/amounts";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import BookingActions from "@/components/admin/bookingActions/BookingActions";
import PaymentsCard, { type PaymentRow } from "@/components/admin/receipts/PaymentsCard";
import { jettyBalance } from "@/lib/booking/actions";
import { formatRM as rm, todayISO } from "@/lib/date";
import styles from "../../../admin.module.css";
import ax from "@/components/admin/bookingActions/bookingActions.module.css";

const SOURCE_LABEL: Record<string, string> = { whatsapp: "WhatsApp", phone: "phone", walk_in: "walk-in", other: "other" };

const STEPS = ["Pending", "Deposit due", "Confirmed", "Completed"];

/** Index of the current step, or -1 when the booking is off the main path. */
function stepIndex(b: { status: string; trip_outcome: string | null }): number {
  if (b.status === "cancelled" || b.status === "weather_hold") return -1;
  if (b.trip_outcome === "completed") return 3;
  return { pending: 0, deposit_due: 1, confirmed: 2 }[b.status] ?? -1;
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStaff();
  if (!profile) redirect("/admin/login");

  const { id } = await params;
  const supabase = await createClient();

  const today = todayISO();
  const [{ data: booking }, { data: paxList }, { data: requests }, { data: boats }, { data: payments }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, email, pax, note, status, night_date, pricing, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, deposit_paid_at, receipt_url, created_at, boat_id, source, balance_paid, balance_paid_at, trip_outcome, cancel_reason, cancelled_at, refund_amount, refunded_at, boats(code, skipper_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("booking_pax")
      .select("id, full_name")
      .eq("booking_id", id)
      .order("sort_order"),
    supabase
      .from("booking_requests")
      .select("id, kind, new_date, note, refund_amount, status, created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: false })
      .returns<RequestRow[]>(),
    supabase.from("boats").select("id, code, capacity").eq("active", true).order("sort_order").order("code"),
    // RLS: admins only; vendors get no rows and see no money.
    supabase
      .from("payments")
      .select("id, kind, amount, method, paid_at, proof_path, note, receipt_no, receipt_token, voided_at, void_reason, emailed_at, whatsapped_at")
      .eq("booking_id", id)
      .order("paid_at"),
  ]);

  if (!booking) notFound();

  const boat = Array.isArray(booking.boats) ? booking.boats[0] : booking.boats;
  const totalAmount = bookingTotal(booking);
  const balanceDue = jettyBalance(booking);
  const step = stepIndex(booking);
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
                {booking.source && booking.source !== "website" ? ` via ${SOURCE_LABEL[booking.source] ?? booking.source}` : ""}
              </div>
              {step >= 0 ? (
                <ol className={ax.stepper} aria-label="Booking progress">
                  {STEPS.map((s, i) => (
                    <li key={s} className={`${ax.step} ${i < step ? ax.stepDone : ""} ${i === step ? ax.stepNow : ""}`} aria-current={i === step ? "step" : undefined}>
                      {s}
                    </li>
                  ))}
                </ol>
              ) : booking.status === "cancelled" ? (
                <p className={`${ax.banner} ${ax.bannerDanger}`}>
                  Cancelled{booking.cancelled_at ? ` ${formatLongDate(booking.cancelled_at.slice(0, 10))}` : ""}
                  {booking.cancel_reason ? `: ${booking.cancel_reason}` : ""}.
                  {Number(booking.refund_amount ?? 0) > 0
                    ? booking.refunded_at
                      ? ` Refund ${rm(Number(booking.refund_amount))} paid ${formatLongDate(booking.refunded_at.slice(0, 10))}.`
                      : ` Refund ${rm(Number(booking.refund_amount))} still to pay.`
                    : ""}
                </p>
              ) : (
                <p className={`${ax.banner} ${ax.bannerWarn}`}>On weather hold. Move it to a new date, or cancel with a full refund.</p>
              )}
              {booking.trip_outcome === "no_show" && (
                <p className={`${ax.banner} ${ax.bannerDanger}`}>Marked as no-show.</p>
              )}
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
                <p className={styles.emptyCardBody}>No guest names recorded yet.</p>
              )}
            </div>

            {profile.role !== "vendor" && (
              <BookingRequests bookingId={booking.id} boatId={booking.boat_id} bookingStatus={booking.status} requests={requests ?? []} />
            )}

            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Skipper note</span>
              <p className={styles.skipperNote}>{booking.note ?? "No note."}</p>
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
            <div>
            <div className={styles.detailCard}>
              <span className={styles.detailCardLabel}>Actions</span>
              <BookingActions
                variant="panel"
                today={today}
                boats={boats ?? []}
                booking={{
                  id: booking.id,
                  ref: booking.ref,
                  full_name: booking.full_name,
                  phone: booking.phone,
                  email: booking.email,
                  pax: booking.pax,
                  boat_id: booking.boat_id,
                  boat_code: boat?.code ?? "?",
                  status: booking.status,
                  night_date: booking.night_date,
                  total_amount: booking.total_amount,
                  deposit_amount: booking.deposit_amount,
                  deposit_paid: booking.deposit_paid,
                  pay_plan: booking.pay_plan,
                  balance_paid: booking.balance_paid,
                  trip_outcome: booking.trip_outcome,
                  refund_amount: booking.refund_amount,
                  refunded_at: booking.refunded_at,
                }}
              />
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
                depositAmount: upfrontAmount(booking),
                depositPaid: booking.deposit_paid,
                depositPaidAt: booking.deposit_paid_at,
                receiptUrl: booking.receipt_url,
              }}
            />
            <PaymentsCard bookingId={booking.id} payments={(payments ?? []) as PaymentRow[]} hasEmail={!!booking.email} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
