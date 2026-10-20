import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import { FALLBACK_SEASON, monthKey, monthsBetween } from "@/lib/season";
import { addDaysISO, formatRM, todayISO, myMidnightUTC } from "@/lib/date";
import { amountPaid, balanceDue, upfrontAmount } from "@/lib/booking/amounts";
import styles from "../../admin.module.css";

type Row = {
  boat_id: string;
  night_date: string;
  status: string;
  deposit_paid: boolean;
  deposit_amount: number;
  total_amount: number;
  pay_plan: string | null;
  boats: { code: string } | null;
};

type BoatMoney = { code: string; sold: number; value: number; collected: number; balance: number };

const SOLD_STATUSES = new Set(["confirmed", "deposit_due", "weather_hold"]);

/** Funnel steps in order (table funnel_events, written by the website). */
const STEPS: Array<[string, string]> = [
  ["home_view", "Visited homepage"],
  ["search", "Searched boats"],
  ["boat_view", "Opened a boat"],
  ["date_picked", "Picked a date"],
  ["details", "Entered details"],
  ["payment", "Reached payment"],
  ["booked", "Booked"],
];

export default async function ReportsPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("packages")
    .select("season_start, season_end")
    .eq("published", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const seasonStart = pkg?.season_start ?? FALLBACK_SEASON.start;
  const seasonEnd = pkg?.season_end ?? FALLBACK_SEASON.end;
  const since = addDaysISO(todayISO(), -30);

  const { data: leadRows } = await supabase
    .from("leads")
    .select("source, stage, lost_reason, created_at, stage_changed_at, bookings!leads_booking_id_fkey(total_amount)")
    .gte("created_at", myMidnightUTC(addDaysISO(todayISO(), -183)));
  const leadMonths = new Map<string, { leads: number; won: number; lost: number; amount: number }>();
  const lostWhy = new Map<string, number>();
  for (const l of leadRows ?? []) {
    const m = l.created_at.slice(0, 7);
    const row = leadMonths.get(m) ?? { leads: 0, won: 0, lost: 0, amount: 0 };
    row.leads += 1;
    if (l.stage === "won") {
      row.won += 1;
      const bk = Array.isArray(l.bookings) ? l.bookings[0] : l.bookings;
      row.amount += Number((bk as { total_amount?: number } | null)?.total_amount ?? 0);
    }
    if (l.stage === "lost") {
      row.lost += 1;
      lostWhy.set(l.lost_reason ?? "Other", (lostWhy.get(l.lost_reason ?? "Other") ?? 0) + 1);
    }
    leadMonths.set(m, row);
  }
  const leadTable = Array.from(leadMonths).sort((a, b) => b[0].localeCompare(a[0]));
  const topLost = Array.from(lostWhy).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const [{ data: bookings }, { data: boats }, { data: vendors }, { data: funnel }] = await Promise.all([
    supabase
      .from("bookings")
      .select("boat_id, night_date, status, deposit_paid, deposit_amount, total_amount, pay_plan, boats(code)")
      .gte("night_date", seasonStart)
      .lte("night_date", seasonEnd),
    supabase.from("boats").select("id, code, vendor_id, active").order("code"),
    supabase.from("profiles").select("id, full_name").eq("role", "vendor"),
    supabase
      .from("funnel_events")
      .select("event, session")
      .gte("at", `${since}T00:00:00+08:00`)
      .limit(20000),
  ]);

  const rows = (bookings ?? []) as unknown as Row[];

  const collectedRows = rows.filter((r) => r.deposit_paid && r.status !== "cancelled");
  const totalCollected = collectedRows.reduce((sum, r) => sum + upfrontAmount(r), 0);

  const soldRows = rows.filter((r) => SOLD_STATUSES.has(r.status));
  const soldNightKeys = new Set(soldRows.map((r) => `${r.boat_id}-${r.night_date}`));
  const boatsWithSales = new Set(soldRows.map((r) => r.boat_id));

  // Monthly chart: payments collected, grouped by the night's year and month
  // (grouping by month alone added Mac 2026 and Mac 2027 together). A season
  // spanning a closed winter would show a run of empty bars, so months with no
  // bookings at all are dropped once the season is longer than a year.
  const seasonMonths = monthsBetween(seasonStart, seasonEnd);
  const multiYear = seasonMonths[0]?.year !== seasonMonths[seasonMonths.length - 1]?.year;
  const bookedKeys = new Set(rows.map((r) => r.night_date.slice(0, 7)));
  const chartMonths =
    seasonMonths.length > 12 ? seasonMonths.filter((m) => bookedKeys.has(monthKey(m))) : seasonMonths;
  const monthlyTotals = chartMonths.map((m) => {
    const key = monthKey(m);
    const sum = collectedRows
      .filter((r) => r.night_date.startsWith(key))
      .reduce((s, r) => s + upfrontAmount(r), 0);
    const short = m.name.slice(0, 3).toUpperCase();
    return { key, label: multiYear ? `${short} ${String(m.year).slice(2)}` : short, value: sum };
  });
  const maxMonthly = Math.max(1, ...monthlyTotals.map((m) => m.value));

  // ---- Revenue by vendor and boat.
  const vendorName = new Map((vendors ?? []).map((v) => [v.id as string, v.full_name as string]));
  const money = new Map<string, BoatMoney>();
  for (const bt of boats ?? []) money.set(bt.id, { code: bt.code, sold: 0, value: 0, collected: 0, balance: 0 });
  for (const r of rows) {
    const m = money.get(r.boat_id);
    if (!m) continue;
    if (r.status !== "cancelled") m.collected += amountPaid(r);
    if (SOLD_STATUSES.has(r.status)) {
      m.sold += 1;
      m.value += Number(r.total_amount);
      m.balance += balanceDue(r);
    }
  }
  const groups = new Map<string, { name: string; own: boolean; boats: BoatMoney[] }>();
  for (const bt of boats ?? []) {
    const key = bt.vendor_id ?? "own";
    const g = groups.get(key) ?? {
      name: bt.vendor_id ? vendorName.get(bt.vendor_id) ?? "Vendor" : "Sakura Tackle (own boats)",
      own: !bt.vendor_id,
      boats: [],
    };
    const m = money.get(bt.id)!;
    // Inactive boats only appear when they have something to report.
    if (bt.active || m.sold || m.collected) g.boats.push(m);
    groups.set(key, g);
  }
  const vendorGroups = Array.from(groups.values())
    .filter((g) => g.boats.length > 0)
    .sort((a, b) => (a.own ? -1 : b.own ? 1 : a.name.localeCompare(b.name)));
  const sumOf = (bs: BoatMoney[], k: Exclude<keyof BoatMoney, "code">) => bs.reduce((s, b) => s + b[k], 0);
  const boatRevenue = Array.from(money.values())
    .filter((b) => b.sold || b.collected)
    .sort((a, b) => b.collected - a.collected);

  // ---- Booking funnel: distinct sessions reaching each step.
  const sessionsAt = new Map<string, Set<string>>();
  for (const f of funnel ?? []) {
    const set = sessionsAt.get(f.event) ?? new Set<string>();
    set.add(f.session);
    sessionsAt.set(f.event, set);
  }
  const funnelRows = STEPS.map(([key, label]) => ({ key, label, n: sessionsAt.get(key)?.size ?? 0 }));
  const funnelTop = Math.max(1, ...funnelRows.map((f) => f.n));

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
              Payments received &#183; {boatsWithSales.size} boats, {soldNightKeys.size} nights sold
            </span>
            <div className={styles.chartRow}>
              {monthlyTotals.map((m) => (
                <div key={m.key} className={styles.chartBarCol}>
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
                <p className={styles.emptyCardTitle}>No sales yet</p>
                <p className={styles.emptyCardBody}>Figures appear once bookings come in.</p>
              </div>
            ) : (
              boatRevenue.map((r) => (
                <div key={r.code} className={styles.byBoatRow}>
                  <div>
                    <span className={styles.byBoatCode}>{r.code}</span>
                    <span className={styles.byBoatNights}>
                      {r.sold} {r.sold === 1 ? "trip" : "trips"}
                    </span>
                  </div>
                  <span className={styles.byBoatAmount}>{formatRM(r.collected)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.detailCard} style={{ marginTop: 18 }}>
          <span className={styles.detailCardLabel}>Revenue by vendor and boat (this season)</span>
          <div className={styles.dtScroll}>
            <table className={styles.dtTable}>
              <thead>
                <tr>
                  <th>Boat</th>
                  <th className={styles.dtNum}>Trips sold</th>
                  <th className={styles.dtNum}>Booking value</th>
                  <th className={styles.dtNum}>Collected</th>
                  <th className={styles.dtNum}>Balance at jetty</th>
                </tr>
              </thead>
              <tbody>
                {vendorGroups.map((g) => (
                  <Fragment key={g.name}>
                    <tr className={styles.revGroup}>
                      <td>{g.name}</td>
                      <td className={styles.dtNum}>{sumOf(g.boats, "sold")}</td>
                      <td className={styles.dtNum}>{formatRM(sumOf(g.boats, "value"))}</td>
                      <td className={styles.dtNum}>{formatRM(sumOf(g.boats, "collected"))}</td>
                      <td className={styles.dtNum}>{formatRM(sumOf(g.boats, "balance"))}</td>
                    </tr>
                    {g.boats.map((b) => (
                      <tr key={b.code}>
                        <td className={styles.revBoat}>{b.code}</td>
                        <td className={styles.dtNum}>{b.sold}</td>
                        <td className={styles.dtNum}>{formatRM(b.value)}</td>
                        <td className={styles.dtNum}>{formatRM(b.collected)}</td>
                        <td className={styles.dtNum}>{formatRM(b.balance)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.reportsNote}>
            Booking value counts confirmed, deposit-due and weather-hold bookings. Collected is payment
            verified (deposit or full), cancelled bookings excluded.
          </p>
        </div>

        <div className={styles.detailCard} style={{ marginTop: 18 }}>
          <span className={styles.detailCardLabel}>Booking funnel (last 30 days)</span>
          <div className={styles.funnel}>
            {funnelRows.map((f, i) => {
              const prev = i > 0 ? funnelRows[i - 1].n : 0;
              return (
                <div key={f.key} className={styles.funnelRow}>
                  <span className={styles.funnelLabel}>{f.label}</span>
                  <span className={styles.funnelTrack}>
                    <span className={styles.funnelFill} style={{ width: `${(f.n / funnelTop) * 100}%` }} />
                  </span>
                  <span className={styles.funnelNum}>
                    {f.n}
                    {i > 0 && prev > 0 && <small> {Math.round((f.n / prev) * 100)}%</small>}
                  </span>
                </div>
              );
            })}
          </div>
          <p className={styles.reportsNote}>
            Visitors (browser sessions) reaching each step; the percentage is from the step above.
            Anonymous: no names or phone numbers are recorded.
          </p>
        </div>

        <div className={styles.detailCard} style={{ marginTop: 18 }}>
          <span className={styles.detailCardLabel}>Leads funnel (last 6 months)</span>
          {leadTable.length === 0 ? (
            <p className={styles.reportsNote}>No leads yet. Add them on the Leads page, or import a sheet.</p>
          ) : (
            <div className={styles.dtScroll}>
              <table className={styles.dtTable}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className={styles.dtNum}>Leads</th>
                    <th className={styles.dtNum}>Won</th>
                    <th className={styles.dtNum}>Lost</th>
                    <th className={styles.dtNum}>Win rate</th>
                    <th className={styles.dtNum}>Booked from leads</th>
                  </tr>
                </thead>
                <tbody>
                  {leadTable.map(([m, x]) => (
                    <tr key={m}>
                      <td>{new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</td>
                      <td className={styles.dtNum}>{x.leads}</td>
                      <td className={styles.dtNum}>{x.won}</td>
                      <td className={styles.dtNum}>{x.lost}</td>
                      <td className={styles.dtNum}>{x.won + x.lost ? `${Math.round((x.won / (x.won + x.lost)) * 100)}%` : "—"}</td>
                      <td className={styles.dtNum}>{formatRM(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.reportsNote}>
            By the month the lead came in. Win rate counts closed leads only.
            {topLost.length > 0 && ` Top reasons lost: ${topLost.map(([r, n]) => `${r} (${n})`).join(", ")}.`}
          </p>
        </div>
      </div>
    </>
  );
}
