import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import { MONTHS, isoDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../admin.module.css";

type Row = {
  boat_id: string;
  night_date: string;
  status: string;
  deposit_paid: boolean;
  deposit_amount: number;
  boats: { code: string } | null;
};

const SOLD_STATUSES = new Set(["confirmed", "deposit_due", "weather_hold"]);

export default async function ReportsPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("packages")
    .select("season_start, season_end")
    .eq("published", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const seasonStart = pkg?.season_start ?? isoDate(0, 1);
  const seasonEnd = pkg?.season_end ?? isoDate(MONTHS.length - 1, MONTHS[MONTHS.length - 1].days);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("boat_id, night_date, status, deposit_paid, deposit_amount, boats(code)")
    .gte("night_date", seasonStart)
    .lte("night_date", seasonEnd);

  const rows = (bookings ?? []) as unknown as Row[];

  const collectedRows = rows.filter((r) => r.deposit_paid);
  const totalCollected = collectedRows.reduce((sum, r) => sum + Number(r.deposit_amount), 0);

  const soldRows = rows.filter((r) => SOLD_STATUSES.has(r.status));
  const soldNightKeys = new Set(soldRows.map((r) => `${r.boat_id}-${r.night_date}`));
  const boatsWithSales = new Set(soldRows.map((r) => r.boat_id));

  // Monthly chart: deposits collected, grouped by the night's month.
  const monthlyTotals = MONTHS.map((m) => {
    const sum = collectedRows
      .filter((r) => Number(r.night_date.slice(5, 7)) - 1 === m.m)
      .reduce((s, r) => s + Number(r.deposit_amount), 0);
    return { label: m.name.slice(0, 3).toUpperCase(), value: sum };
  });
  const maxMonthly = Math.max(1, ...monthlyTotals.map((m) => m.value));

  // By boat: distinct nights sold + deposits collected, per boat.
  const byBoat = new Map<string, { code: string; nights: Set<string>; amount: number }>();
  for (const r of soldRows) {
    const code = r.boats?.code ?? "?";
    const entry = byBoat.get(r.boat_id) ?? { code, nights: new Set<string>(), amount: 0 };
    entry.nights.add(r.night_date);
    byBoat.set(r.boat_id, entry);
  }
  for (const r of collectedRows) {
    const code = r.boats?.code ?? "?";
    const entry = byBoat.get(r.boat_id) ?? { code, nights: new Set<string>(), amount: 0 };
    entry.amount += Number(r.deposit_amount);
    byBoat.set(r.boat_id, entry);
  }
  const boatRevenue = Array.from(byBoat.values())
    .map((b) => ({ code: b.code, nights: b.nights.size, amount: b.amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Season ${seasonStart.slice(0, 4)} to date`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <div className={styles.reportsGrid}>
          <div className={styles.reportsCard}>
            <span className={styles.detailCardLabel}>Collected this season</span>
            <div className={styles.reportsBig}>{formatRM(totalCollected)}</div>
            <span className={styles.reportsNote}>
              Deposit sahaja &#183; {boatsWithSales.size} bot, {soldNightKeys.size} malam
              dijual
            </span>
            <div className={styles.chartRow}>
              {monthlyTotals.map((m) => (
                <div key={m.label} className={styles.chartBarCol}>
                  <div
                    className={styles.chartBar}
                    style={{ height: `${Math.max(4, (m.value / maxMonthly) * 100)}%` }}
                  />
                  <span className={styles.chartLabel}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.byBoatCard}>
            <div className={styles.byBoatHeader}>By boat</div>
            {boatRevenue.length === 0 ? (
              <div className={styles.emptyCard} style={{ margin: 16 }}>
                <p className={styles.emptyCardTitle}>Tiada jualan lagi</p>
                <p className={styles.emptyCardBody}>Data akan muncul apabila ada tempahan.</p>
              </div>
            ) : (
              boatRevenue.map((r) => (
                <div key={r.code} className={styles.byBoatRow}>
                  <div>
                    <span className={styles.byBoatCode}>{r.code}</span>
                    <span className={styles.byBoatNights}>
                      {r.nights} {r.nights === 1 ? "night" : "nights"}
                    </span>
                  </div>
                  <span className={styles.byBoatAmount}>{formatRM(r.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
