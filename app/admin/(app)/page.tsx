import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import HarbourHQ, { type ManifestRow } from "@/components/admin/HarbourHQ";
import type { HarbourBoat } from "@/components/three/harbour/HarbourScene";
import { myMinutes, tripNightISO } from "@/lib/harbour";
import { formatLongDate } from "@/lib/season";
import {
  addDaysISO,
  firstOfMonthISO,
  formatMalayFullDate,
  formatRM,
  formatRMCompact,
  myMidnightUTC,
  previousMonthRangeISO,
  todayISO,
} from "@/lib/date";
import { STATUS_LABEL, statusPill } from "@/components/admin/bookingStatus";
import { upfrontAmount } from "@/lib/booking/amounts";
import BookingStrip, { type StripCell } from "@/components/admin/schedule/BookingStrip";
import { cellNote } from "@/components/admin/schedule/ScheduleViews";
import {
  cellFor,
  loadSchedule,
  loadScheduleBoats,
  loadSeason,
  nightsBetween,
} from "@/lib/booking/schedule";
import { FALLBACK_SEASON } from "@/lib/season";
import styles from "../admin.module.css";

type BookingRow = {
  id: string;
  ref: string;
  full_name: string;
  pax: number;
  price_per_pax: number;
  total_amount: number;
  status: string;
  night_date: string;
  boats: { code: string } | null;
};

export default async function DashboardPage() {
  const profile = await requireStaff();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const today = todayISO();
  const in7 = addDaysISO(today, 6);
  const in30 = addDaysISO(today, 29);
  const monthStart = firstOfMonthISO(today);
  const { start: prevMonthStart, end: prevMonthEnd } = previousMonthRangeISO(today);

  // Harbour HQ shows the trip that is under way, so before 07:30 it is
  // still last night's boats out at sea.
  const tripNight = tripNightISO(today, myMinutes());

  const [harbourBoats, harbourBookings, harbourBlocks] = await Promise.all([
    (profile.role === "vendor"
      ? supabase.from("boats").select("id, code, length_ft, beam, capacity").eq("vendor_id", profile.userId)
      : supabase.from("boats").select("id, code, length_ft, beam, capacity")
    )
      .eq("active", true)
      .order("sort_order")
      .order("code"),
    supabase
      .from("bookings")
      .select("id, ref, full_name, pax, status, boat_id")
      .eq("night_date", tripNight)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase.from("trip_nights").select("boat_id").eq("night_date", tripNight).eq("blocked", true),
  ]);

  const manifests: Record<string, ManifestRow[]> = {};
  for (const b of harbourBookings.data ?? []) (manifests[b.boat_id] ??= []).push(b);
  const blocked = new Set((harbourBlocks.data ?? []).map((t) => t.boat_id));
  const hqBoats: HarbourBoat[] = (harbourBoats.data ?? []).map((b) => {
    const list = manifests[b.id] ?? [];
    const weather = list.some((m) => m.status === "weather_hold");
    const pax = list
      .filter((m) => m.status !== "weather_hold")
      .reduce((n, m) => n + m.pax, 0);
    return {
      id: b.id,
      code: b.code,
      lengthFt: b.length_ft,
      beam: b.beam,
      capacity: b.capacity,
      pax,
      sailing: pax > 0 && !weather && !blocked.has(b.id),
      weather,
      blocked: blocked.has(b.id),
    };
  });
  const nightLabel = `${tripNight === today ? "Tonight" : "Last night"}, ${formatLongDate(tripNight)}`;

  // Booking strip: the next 30 nights, one row per boat.
  const stripNights = nightsBetween(today, in30);
  const [stripBoats, season] = await Promise.all([
    loadScheduleBoats(supabase, profile),
    loadSeason(supabase, FALLBACK_SEASON),
  ]);
  const stripData = await loadSchedule(
    supabase,
    stripBoats.map((b) => b.id),
    today,
    in30
  );
  const stripCells: Record<string, StripCell[]> = {};
  for (const b of stripBoats) {
    stripCells[b.id] = stripNights.map((n) => {
      const c = cellFor(stripData, b, n, season);
      return { status: c.status, pax: c.pax, note: cellNote(c) };
    });
  }

  const [tonightRes, depositDueRes, nightsRes, collectedRes, prevCollectedRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, ref, full_name, pax, price_per_pax, total_amount, status, night_date, boats(code)")
        .eq("night_date", today)
        .in("status", ["confirmed", "deposit_due"])
        .order("created_at"),
      supabase
        .from("bookings")
        .select("id, total_amount, deposit_amount, pay_plan")
        .eq("status", "deposit_due"),
      supabase
        .from("trip_night_status")
        .select("night_date, status, pax_held")
        .gte("night_date", today)
        .lte("night_date", in30),
      supabase
        .from("bookings")
        .select("total_amount, deposit_amount, pay_plan")
        .eq("deposit_paid", true)
        .gte("deposit_paid_at", myMidnightUTC(monthStart)),
      supabase
        .from("bookings")
        .select("total_amount, deposit_amount, pay_plan")
        .eq("deposit_paid", true)
        .gte("deposit_paid_at", myMidnightUTC(prevMonthStart))
        .lt("deposit_paid_at", myMidnightUTC(prevMonthEnd)),
    ]);

  const tonight = (tonightRes.data ?? []) as unknown as BookingRow[];
  const boatsSailingTonight = new Set(tonight.map((b) => b.boats?.code).filter(Boolean)).size;
  const paxTonight = tonight.reduce((sum, b) => sum + b.pax, 0);

  const depositDueRows = depositDueRes.data ?? [];
  const depositOutstanding = depositDueRows.reduce(
    (sum, b) => sum + upfrontAmount(b),
    0
  );

  const nights = nightsRes.data ?? [];
  const nightsSoldThisWeek = nights.filter(
    (n) => n.night_date <= in7 && Number(n.pax_held) > 0
  ).length;
  const openSlotsNext30 = nights.filter((n) => n.status === "open").length;

  const collectedMTD = (collectedRes.data ?? []).reduce(
    (sum, b) => sum + upfrontAmount(b),
    0
  );
  const collectedPrevMonth = (prevCollectedRes.data ?? []).reduce(
    (sum, b) => sum + upfrontAmount(b),
    0
  );
  const mtdNote =
    collectedPrevMonth > 0
      ? `up from ${formatRM(collectedPrevMonth)}`
      : collectedMTD > 0
      ? "first collections this month"
      : "no collections yet";

  const kpis = [
    {
      label: "Deposit due",
      value: String(depositDueRows.length),
      note: `${formatRM(depositOutstanding)} outstanding`,
      color: "var(--warn-text-2)",
    },
    {
      label: "This week",
      value: String(nightsSoldThisWeek),
      note: "nights sold",
      color: "var(--ink)",
    },
    {
      label: "Collected MTD",
      value: formatRMCompact(collectedMTD),
      note: mtdNote,
      color: "var(--success-text)",
    },
    {
      label: "Open slots",
      value: String(openSlotsNext30),
      note: "next 30 nights",
      color: "var(--ink)",
    },
  ];

  return (
    <>
      <PageHeader
        title="Tonight"
        subtitle={formatMalayFullDate(today)}
        avatarInitials={profile.initials}
        actions={
          <Link href="/admin/calendar" className={styles.headerActionBtn}>
            New booking
          </Link>
        }
      />

      <div className={styles.main}>
        <HarbourHQ boats={hqBoats} manifests={manifests} nightLabel={nightLabel} />

        <BookingStrip
          boats={stripBoats.map((b) => ({
            id: b.id,
            code: b.code,
            capacity: b.capacity,
            jettyName: b.jettyName,
          }))}
          nights={stripNights}
          today={today}
          cells={stripCells}
        />

        <div className={styles.dashTop}>
          <div className={styles.dashCardPurple}>
            <span className={styles.dashKicker}>Sailing tonight</span>
            <div className={styles.dashBig}>{boatsSailingTonight} boats</div>
            <div className={styles.dashNote}>
              {paxTonight} pax total. {tonight.length} booking{tonight.length === 1 ? "" : "s"}{" "}
              holding a seat tonight.
            </div>
          </div>
          <div className={styles.dashCardGold}>
            <span className={styles.dashKicker}>Deposit outstanding</span>
            <div className={styles.dashBig}>{formatRM(depositOutstanding)}</div>
            <div className={styles.dashNote}>
              {depositDueRows.length} booking{depositDueRows.length === 1 ? "" : "s"} waiting on
              deposit.
            </div>
          </div>
        </div>

        <div className={styles.kpiGrid}>
          {kpis.map((k) => (
            <div key={k.label} className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{k.label}</span>
              <span className={styles.kpiValue} style={{ color: k.color }}>
                {k.value}
              </span>
              <span className={styles.kpiNote}>{k.note}</span>
            </div>
          ))}
        </div>

        <span className={styles.manifestKicker}>Tonight&apos;s manifest</span>
        {tonight.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyCardTitle}>Tiada bot belayar malam ini</p>
            <p className={styles.emptyCardBody}>
              Tiada tempahan disahkan untuk {formatMalayFullDate(today)}.
            </p>
          </div>
        ) : (
          <div className={styles.manifestList}>
            {tonight.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className={styles.manifestRow}
              >
                <div className={styles.manifestBoatBadge}>
                  <span className={styles.manifestBoatBadgeLabel}>BOT</span>
                  <span className={styles.manifestBoatBadgeCode}>
                    {b.boats?.code.split(" ")[0] ?? "?"}
                  </span>
                </div>
                <div className={styles.manifestInfo}>
                  <span className={styles.manifestName} data-pii="name">{b.full_name}</span>
                  <span className={styles.manifestMeta}>
                    {b.boats?.code ?? "?"}, {b.pax} pax, {formatRM(Number(b.total_amount))}
                  </span>
                </div>
                <span className={statusPill(b.status)}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
