import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
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
import styles from "../admin.module.css";

type BookingRow = {
  id: string;
  ref: string;
  full_name: string;
  pax: number;
  price_per_pax: number;
  status: string;
  night_date: string;
  boats: { code: string } | null;
};

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

export default async function DashboardPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const today = todayISO();
  const in7 = addDaysISO(today, 6);
  const in30 = addDaysISO(today, 29);
  const monthStart = firstOfMonthISO(today);
  const { start: prevMonthStart, end: prevMonthEnd } = previousMonthRangeISO(today);

  const [tonightRes, depositDueRes, nightsRes, collectedRes, prevCollectedRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, ref, full_name, pax, price_per_pax, status, night_date, boats(code)")
        .eq("night_date", today)
        .in("status", ["confirmed", "deposit_due"])
        .order("created_at"),
      supabase
        .from("bookings")
        .select("id, deposit_amount")
        .eq("status", "deposit_due"),
      supabase
        .from("trip_night_status")
        .select("night_date, status, pax_held")
        .gte("night_date", today)
        .lte("night_date", in30),
      supabase
        .from("bookings")
        .select("deposit_amount")
        .eq("deposit_paid", true)
        .gte("deposit_paid_at", myMidnightUTC(monthStart)),
      supabase
        .from("bookings")
        .select("deposit_amount")
        .eq("deposit_paid", true)
        .gte("deposit_paid_at", myMidnightUTC(prevMonthStart))
        .lt("deposit_paid_at", myMidnightUTC(prevMonthEnd)),
    ]);

  const tonight = (tonightRes.data ?? []) as unknown as BookingRow[];
  const boatsSailingTonight = new Set(tonight.map((b) => b.boats?.code).filter(Boolean)).size;
  const paxTonight = tonight.reduce((sum, b) => sum + b.pax, 0);

  const depositDueRows = depositDueRes.data ?? [];
  const depositOutstanding = depositDueRows.reduce(
    (sum, b) => sum + Number(b.deposit_amount),
    0
  );

  const nights = nightsRes.data ?? [];
  const nightsSoldThisWeek = nights.filter(
    (n) => n.night_date <= in7 && Number(n.pax_held) > 0
  ).length;
  const openSlotsNext30 = nights.filter((n) => n.status === "open").length;

  const collectedMTD = (collectedRes.data ?? []).reduce(
    (sum, b) => sum + Number(b.deposit_amount),
    0
  );
  const collectedPrevMonth = (prevCollectedRes.data ?? []).reduce(
    (sum, b) => sum + Number(b.deposit_amount),
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
                  <span className={styles.manifestName}>{b.full_name}</span>
                  <span className={styles.manifestMeta}>
                    {b.boats?.code ?? "?"}, {b.pax} pax, {formatRM(b.pax * b.price_per_pax)}
                  </span>
                </div>
                <span className={`${styles.manifestStatus} ${STATUS_CLASS[b.status] ?? ""}`}>
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
