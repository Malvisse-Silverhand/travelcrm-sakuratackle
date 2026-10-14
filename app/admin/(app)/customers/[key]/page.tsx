import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import { waNumber } from "@/lib/phone";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import {
  customerKey,
  phoneVariants,
  summarise,
  type CustomerBooking,
} from "@/lib/admin/customers";
import { formatLongDate } from "@/lib/season";
import { formatRM, todayISO } from "@/lib/date";
import styles from "../../../admin.module.css";

export default async function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const key = customerKey(decodeURIComponent((await params).key));
  if (key.length < 9) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, deposit_amount, deposit_paid, created_at, boats(code)"
    )
    .in("phone", phoneVariants(key))
    .order("night_date", { ascending: false });

  const bookings = (data ?? []) as unknown as CustomerBooking[];
  if (bookings.length === 0) notFound();

  const today = todayISO();
  const c = summarise(key, bookings, today);

  return (
    <>
      <PageHeader title="Customer" subtitle={c.name} avatarInitials={profile.initials} />
      <div className={styles.main}>
        <Link href="/admin/customers" className={styles.backLink}>
          &#8592; All customers
        </Link>

        <div className={styles.detailCard}>
          <div className={styles.detailCardHead}>
            <span className={styles.detailName}>{c.name}</span>
            {c.trips >= 2 && <span className={statusPill("confirmed")}>Repeat customer</span>}
          </div>
          <div className={styles.detailRefLine}>
            Customer since {formatLongDate(c.firstBooked.slice(0, 10))}
          </div>
          <div className={styles.detailStatsGrid}>
            <div>
              <span className={styles.detailStatLabel}>Phone</span>
              <span className={styles.detailStatValue}>{c.key}</span>
            </div>
            <div>
              <span className={styles.detailStatLabel}>Email</span>
              <span className={styles.detailStatValue}>{c.email ?? "—"}</span>
            </div>
            <div>
              <span className={styles.detailStatLabel}>Trips</span>
              <span className={styles.detailStatValue}>
                {c.trips}
                {c.cancelled > 0 ? ` (+${c.cancelled} cancelled)` : ""}
              </span>
            </div>
            <div>
              <span className={styles.detailStatLabel}>Next trip</span>
              <span className={styles.detailStatValue}>
                {c.nextTrip ? formatLongDate(c.nextTrip) : "—"}
              </span>
            </div>
            <div>
              <span className={styles.detailStatLabel}>Booked value</span>
              <span className={styles.detailStatValue}>{formatRM(c.value)}</span>
            </div>
            <div>
              <span className={styles.detailStatLabel}>Deposits paid</span>
              <span className={styles.detailStatValue}>{formatRM(c.depositsPaid)}</span>
            </div>
          </div>
          <div className={styles.dtActions} style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <a
              href={`https://wa.me/${waNumber(c.key)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.dtBtn} ${styles.dtBtnWa}`}
            >
              WhatsApp {c.name.split(" ")[0]}
            </a>
            <Link href="/admin/calendar" className={`${styles.dtBtn} ${styles.dtBtnGhost}`}>
              New booking
            </Link>
          </div>
        </div>

        <span className={styles.manifestKicker}>Booking history</span>
        <div className={styles.dtCard}>
          <div className={styles.dtScroll}>
            <table className={styles.dtTable}>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Night</th>
                  <th>Boat</th>
                  <th className={styles.dtNum}>Pax</th>
                  <th className={styles.dtNum}>Total</th>
                  <th>Deposit</th>
                  <th>Status</th>
                  <th className={styles.dtNum}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className={styles.dtStrong}>{b.ref}</td>
                    <td>
                      {formatLongDate(b.night_date)}
                      {b.night_date >= today && b.status !== "cancelled" && (
                        <span className={styles.dtSub}>Upcoming</span>
                      )}
                    </td>
                    <td>{b.boats?.code ?? "—"}</td>
                    <td className={styles.dtNum}>{b.pax}</td>
                    <td className={styles.dtNum}>{formatRM(b.pax * Number(b.price_per_pax))}</td>
                    <td>{b.deposit_paid ? "Paid" : "—"}</td>
                    <td>
                      <span className={statusPill(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</span>
                    </td>
                    <td>
                      <div className={styles.dtActions}>
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className={`${styles.dtBtn} ${styles.dtBtnView}`}
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className={styles.filterCount} style={{ marginTop: 14 }}>
          Notes and tags (VIP, repeat) arrive with the customer database update.
        </p>
      </div>
    </>
  );
}
