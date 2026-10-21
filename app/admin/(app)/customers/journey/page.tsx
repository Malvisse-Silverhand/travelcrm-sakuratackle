import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import JourneyCalendar from "@/components/admin/journey/JourneyCalendar";
import { journeyEvents, type JourneyBooking, type JourneyPayment } from "@/lib/journey";
import { addDaysISO, myMidnightUTC, todayISO } from "@/lib/date";
import styles from "../../../admin.module.css";

// Customer journey: booked → paid → departure → outcome, on a month
// calendar. Admins see payments; vendors see their own boats' bookings
// (RLS) and no money.

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const profile = await requireStaff();
  const { m } = await searchParams;
  const today = todayISO();
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);
  const isAdmin = profile.role === "admin";

  // Every booking with any event in a window around the month, so customers
  // who booked last month and sail this month show both ends.
  const from = addDaysISO(`${month}-01`, -7);
  const to = addDaysISO(`${month}-01`, 40);
  const fromTs = myMidnightUTC(from);
  const toTs = myMidnightUTC(to);

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("bookings")
    .select(
      "id, ref, full_name, phone, status, night_date, created_at, deposit_paid_at, total_amount, trip_outcome, outcome_at, cancelled_at, boats(code)"
    )
    .or(
      [
        `and(night_date.gte.${from},night_date.lte.${to})`,
        `and(created_at.gte.${fromTs},created_at.lt.${toTs})`,
        `and(deposit_paid_at.gte.${fromTs},deposit_paid_at.lt.${toTs})`,
        `and(outcome_at.gte.${fromTs},outcome_at.lt.${toTs})`,
        `and(cancelled_at.gte.${fromTs},cancelled_at.lt.${toTs})`,
      ].join(",")
    )
    .limit(3000);

  const bookings = (rows ?? []) as unknown as JourneyBooking[];
  let payments: JourneyPayment[] | null = null;
  if (isAdmin && bookings.length) {
    const ids = bookings.map((b) => b.id);
    const all: JourneyPayment[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from("payments")
        .select("booking_id, kind, amount, paid_at, voided_at")
        .in("booking_id", ids.slice(i, i + 200));
      all.push(...((data ?? []) as JourneyPayment[]));
    }
    payments = all;
  }

  const events = journeyEvents(bookings, payments);
  const boats = Array.from(new Set(bookings.map((b) => b.boats?.code).filter(Boolean) as string[])).sort();

  return (
    <>
      <PageHeader
        title="Customer journey"
        subtitle={isAdmin ? "Booked, paid, departure and outcome, by date and time" : "Your boats' customers: booked, departure and outcome"}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <JourneyCalendar events={events} month={month} today={today} boats={boats} showMoney={isAdmin} />
      </div>
    </>
  );
}
