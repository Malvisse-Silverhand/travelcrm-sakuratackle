import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CustomerNotes from "@/components/admin/CustomerNotes";
import { waNumber } from "@/lib/phone";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import {
  customerKey,
  mergeHistory,
  phoneVariants,
  summarise,
  type Customer,
  type CustomerBooking,
  type ImportedCustomer,
  type PastTrip,
} from "@/lib/admin/customers";
import { formatLongDate } from "@/lib/season";
import { formatRM, todayISO } from "@/lib/date";
import styles from "../../../admin.module.css";

export default async function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const profile = await requireAdmin();

  const key = customerKey(decodeURIComponent((await params).key));
  if (key.length < 9) notFound();

  const supabase = await createClient();
  const { data: note } = await supabase
    .from("customer_notes")
    .select("notes, tags")
    .eq("phone_key", key)
    .maybeSingle();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, created_at, boats(code)"
    )
    .in("phone", phoneVariants(key))
    .order("night_date", { ascending: false });

  const [{ data: imported }, { data: pastRows }] = await Promise.all([
    supabase.from("customers").select("phone_key, name, email, tags").eq("phone_key", key).maybeSingle(),
    supabase
      .from("past_trips")
      .select("phone_key, trip_date, boat_label, pax, amount, note")
      .eq("phone_key", key)
      .order("trip_date", { ascending: false }),
  ]);

  const bookings = (data ?? []) as unknown as CustomerBooking[];
  if (bookings.length === 0 && !imported) notFound();

  const today = todayISO();
  const past = (pastRows ?? []) as PastTrip[];
  const base: Customer[] = bookings.length ? [summarise(key, bookings, today)] : [];
  const c = mergeHistory(base, imported ? [imported as ImportedCustomer] : [], past)[0];

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
            {c.source === "imported" ? " · imported, no bookings in the system yet" : c.source === "both" ? " · includes imported history" : ""}
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
            <Link
              href={`/admin/bookings/new?name=${encodeURIComponent(c.name)}&phone=${encodeURIComponent(c.key)}${c.email ? `&email=${encodeURIComponent(c.email)}` : ""}`}
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
            >
              New booking
            </Link>
          </div>
        </div>

        <CustomerNotes
          phoneKey={c.key}
          initialNotes={note?.notes ?? ""}
          initialTags={(note?.tags as string[] | undefined) ?? []}
        />

        {past.length > 0 && (
          <>
            <span className={styles.manifestKicker}>Before the system ({past.length} imported trips)</span>
            <div className={styles.dtCard} style={{ marginBottom: 22 }}>
              <div className={styles.dtScroll}>
                <table className={styles.dtTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Boat</th>
                      <th className={styles.dtNum}>Pax</th>
                      <th className={styles.dtNum}>Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((t, i) => (
                      <tr key={`${t.trip_date}-${i}`}>
                        <td className={styles.dtStrong}>{formatLongDate(t.trip_date)}</td>
                        <td>{t.boat_label ?? "—"}</td>
                        <td className={styles.dtNum}>{t.pax ?? "—"}</td>
                        <td className={styles.dtNum}>{t.amount != null ? formatRM(Number(t.amount)) : "—"}</td>
                        <td>{t.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {bookings.length > 0 && <span className={styles.manifestKicker}>Booking history</span>}
        {bookings.length > 0 && (
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
                    <td className={styles.dtNum}>{formatRM(Number(b.total_amount))}</td>
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
        )}
      </div>
    </>
  );
}
