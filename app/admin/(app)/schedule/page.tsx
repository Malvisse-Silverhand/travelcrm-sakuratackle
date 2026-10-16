import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import ScheduleFilters from "@/components/admin/schedule/ScheduleFilters";
import {
  DayView,
  Legend,
  MonthView,
  WeekView,
  YearView,
  type CellGrid,
} from "@/components/admin/schedule/ScheduleViews";
import {
  VIEWS,
  isISODate,
  monthOf,
  rangeFor,
  stepDate,
  titleFor,
  type ScheduleView,
} from "@/components/admin/schedule/calendarDates";
import {
  cellFor,
  loadScheduleBoats,
  loadSchedule,
  loadSeason,
  nightsBetween,
} from "@/lib/booking/schedule";
import { FALLBACK_SEASON } from "@/lib/season";
import { formatRM, todayISO } from "@/lib/date";
import adminStyles from "../../admin.module.css";
import styles from "@/components/admin/schedule/schedule.module.css";

type Params = { view?: string; date?: string; jetty?: string; vendor?: string; boat?: string };

const VIEW_LABEL: Record<ScheduleView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};

/** Booking calendar: every boat's bookings by day, week, month or year,
 *  filtered by location, vendor and boat. Read-only; slots are managed in
 *  the Slot manager (/admin/calendar). */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<Params> }) {
  const profile = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();

  const view: ScheduleView = VIEWS.includes(sp.view as ScheduleView) ? (sp.view as ScheduleView) : "month";
  const date = isISODate(sp.date) ? sp.date : today;
  const jetty = sp.jetty ?? "";
  const vendor = profile.role === "vendor" ? "" : sp.vendor ?? "";
  const boat = sp.boat ?? "";

  const supabase = await createClient();
  const [allBoats, season] = await Promise.all([
    loadScheduleBoats(supabase, profile),
    loadSeason(supabase, FALLBACK_SEASON),
  ]);

  // "own" stands for Sakura Tackle's own boats (no vendor).
  const vendorKey = (b: { vendorId: string | null }) => b.vendorId ?? "own";
  const boats = allBoats.filter(
    (b) =>
      (!jetty || b.jettyId === jetty) &&
      (!vendor || vendorKey(b) === vendor) &&
      (!boat || b.id === boat)
  );

  const { from, to } = rangeFor(view, date);
  const nights = nightsBetween(from, to);
  const data = await loadSchedule(
    supabase,
    boats.map((b) => b.id),
    from,
    to
  );
  const cells: CellGrid = {};
  for (const b of boats) {
    cells[b.id] = {};
    for (const n of nights) cells[b.id][n] = cellFor(data, b, n, season);
  }

  // Totals over the nights the view is about (the month view's grid also
  // shows the edges of the months either side).
  const inScope = view === "month" ? nights.filter((n) => monthOf(n) === monthOf(date)) : nights;
  let bookings = 0;
  let pax = 0;
  let value = 0;
  let depositDue = 0;
  let boatNights = 0;
  let openNights = 0;
  for (const b of boats)
    for (const n of inScope) {
      const c = cells[b.id][n];
      bookings += c.bookings.length;
      pax += c.pax;
      value += c.bookings.reduce((s, x) => s + Number(x.total_amount), 0);
      depositDue += c.bookings.filter((x) => x.status === "deposit_due").length;
      if (c.status !== "off" && c.status !== "blocked") boatNights++;
      if (c.status === "open") openNights++;
    }

  const filters: Record<string, string> = {};
  if (jetty) filters.jetty = jetty;
  if (vendor) filters.vendor = vendor;
  if (boat) filters.boat = boat;
  const href = (v: ScheduleView, d: string, hash = "") =>
    `/admin/schedule?${new URLSearchParams({ view: v, date: d, ...filters }).toString()}${hash}`;
  const dayHref = (n: string, boatId?: string) => href("day", n, boatId ? `#boat-${boatId}` : "");

  const jetties = Array.from(new Map(allBoats.map((b) => [b.jettyId, b.jettyName])).entries()).map(
    ([id, name]) => ({ id, name })
  );
  const vendors =
    profile.role === "vendor"
      ? []
      : Array.from(
          new Map(allBoats.map((b) => [vendorKey(b), b.vendorId ? b.vendorName : "Sakura Tackle (own boats)"]))
        ).map(([id, name]) => ({ id, name }));

  const viewProps = { boats, cells, nights, today, dayHref };

  return (
    <>
      <PageHeader
        title="Booking calendar"
        subtitle={`${boats.length} of ${allBoats.length} boats · ${titleFor(view, date)}`}
        avatarInitials={profile.initials}
        actions={
          <Link href="/admin/calendar" className={adminStyles.headerActionBtn}>
            Slot manager
          </Link>
        }
      />
      <div className={`${adminStyles.main} ${styles.wrap}`}>
        <div className={styles.toolbar}>
          <nav className={styles.tabs} aria-label="Calendar view">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={href(v, date)}
                className={`${styles.tab} ${v === view ? styles.tabOn : ""}`}
                aria-current={v === view ? "page" : undefined}
              >
                {VIEW_LABEL[v]}
              </Link>
            ))}
          </nav>
          <div className={styles.nav}>
            <Link href={href(view, stepDate(view, date, -1))} className={styles.navBtn} aria-label="Previous">
              ‹
            </Link>
            <Link href={href(view, today)} className={styles.navBtn}>
              Today
            </Link>
            <Link href={href(view, stepDate(view, date, 1))} className={styles.navBtn} aria-label="Next">
              ›
            </Link>
            <span className={styles.rangeTitle}>{titleFor(view, date)}</span>
          </div>
        </div>

        <ScheduleFilters
          base={{ view, date }}
          jetty={jetty}
          vendor={vendor}
          boat={boat}
          jetties={jetties}
          vendors={vendors}
          boats={allBoats.map((b) => ({ id: b.id, code: b.code, jettyId: b.jettyId, vendorKey: vendorKey(b) }))}
        />

        <div className={styles.summary}>
          <div className={styles.stat}>
            <b>{bookings}</b>
            <span>bookings · {pax} pax</span>
          </div>
          <div className={styles.stat}>
            <b>{formatRM(value)}</b>
            <span>booking value</span>
          </div>
          <div className={styles.stat}>
            <b>{depositDue}</b>
            <span>waiting on deposit</span>
          </div>
          <div className={styles.stat}>
            <b>
              {openNights}/{boatNights}
            </b>
            <span>boat-nights still open</span>
          </div>
        </div>

        {boats.length === 0 ? (
          <div className={styles.card}>
            <p className={styles.empty}>No active boats match these filters.</p>
          </div>
        ) : (
          <div className={styles.card}>
            {view === "day" && <DayView {...viewProps} />}
            {view === "week" && <WeekView {...viewProps} />}
            {view === "month" && <MonthView {...viewProps} month={monthOf(date)} />}
            {view === "year" && <YearView {...viewProps} monthHref={(n) => href("month", n)} />}
            <Legend year={view === "year" && boats.length > 1} />
          </div>
        )}
      </div>
    </>
  );
}
