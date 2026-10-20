// Dashboard insights and checklists, worked out by rules from bookings (no
// AI). Next 30 days: what must happen before each trip. Last 14 days: what
// is left after it. Plus a few headline insights.

import { addDaysISO } from "@/lib/date";
import { jettyBalance, refundOwed } from "@/lib/booking/actions";
import { upfrontAmount } from "@/lib/booking/amounts";

export type InsightBooking = {
  id: string;
  ref: string;
  full_name: string;
  status: string;
  night_date: string;
  pax: number;
  email: string | null;
  total_amount: number | string;
  deposit_amount: number | string;
  deposit_paid: boolean;
  pay_plan: string | null;
  receipt_url: string | null;
  balance_paid: boolean;
  trip_outcome: string | null;
  refund_amount: number | string | null;
  refunded_at: string | null;
  review_request_sent_at: string | null;
  boat_id: string;
  boats: { code: string } | null;
  guests: number;
  reviewed: boolean;
};

export type Task = {
  key: string;
  bookingId: string;
  ref: string;
  name: string;
  boat: string;
  night: string;
  icon: string;
  tone: "red" | "gold" | "green" | "purple" | "teal";
  text: string;
  /** Where to act. */
  href: string;
  /** Money tasks are hidden from vendors. */
  money?: boolean;
};

export type Insight = { icon: string; tone: Task["tone"]; title: string; body: string; href?: string; money?: boolean };

const LIVE = ["pending", "deposit_due", "confirmed", "weather_hold"];
const rm = (n: number) => "RM" + n.toLocaleString("en-MY");
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayName(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY[dt.getUTCDay()]} ${d} ${dt.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

export function upcomingTasks(list: InsightBooking[], today: string): Task[] {
  const until = addDaysISO(today, 30);
  const out: Task[] = [];
  for (const b of list) {
    if (!LIVE.includes(b.status) || b.night_date < today || b.night_date > until) continue;
    const base = { bookingId: b.id, ref: b.ref, name: b.full_name, boat: b.boats?.code ?? "?", night: b.night_date, href: `/admin/bookings/${b.id}` };
    const days = Math.round((Date.parse(b.night_date) - Date.parse(today)) / 86_400_000);
    const when = days === 0 ? "tonight" : days === 1 ? "tomorrow" : `in ${days} days`;

    if (b.status === "weather_hold") {
      out.push({ ...base, key: `${b.id}-wx`, icon: "cloud", tone: "teal", text: `On weather hold: move to a new date or cancel with refund` });
      continue;
    }
    if (b.receipt_url && !b.deposit_paid) {
      out.push({ ...base, key: `${b.id}-rc`, icon: "receipt", tone: "gold", text: "Receipt uploaded: check it and mark paid", money: true, href: "/admin/payments" });
    } else if (!b.deposit_paid) {
      out.push({
        ...base,
        key: `${b.id}-dep`,
        icon: "card",
        tone: days <= 7 ? "red" : "gold",
        text: `${upfrontAmount(b) ? `${rm(upfrontAmount(b))} ` : ""}deposit not paid, trip ${when}`,
        money: true,
      });
    }
    if (b.guests < b.pax) {
      out.push({ ...base, key: `${b.id}-pax`, icon: "users", tone: "purple", text: `Guest names: ${b.guests} of ${b.pax} filled in` });
    }
    if (b.status === "confirmed" && days <= 2 && jettyBalance(b) > 0) {
      out.push({ ...base, key: `${b.id}-bal`, icon: "coins", tone: "gold", text: `Collect ${rm(jettyBalance(b))} balance at the jetty`, money: true });
    }
    if (b.status === "confirmed" && days <= 3) {
      out.push({ ...base, key: `${b.id}-wxc`, icon: "cloud", tone: "teal", text: `Check the marine forecast, trip ${when}`, href: "https://www.met.gov.my/en/forecast/marine/" });
    }
    if (!b.email && days <= 14) {
      out.push({ ...base, key: `${b.id}-wa`, icon: "whatsapp", tone: "purple", text: "No email: send trip details by WhatsApp" });
    }
  }
  return out.sort((a, b) => a.night.localeCompare(b.night) || toneRank(a.tone) - toneRank(b.tone));
}

export function pastTasks(list: InsightBooking[], today: string): Task[] {
  const from = addDaysISO(today, -14);
  const out: Task[] = [];
  for (const b of list) {
    if (b.night_date >= today || b.night_date < from) continue;
    const base = { bookingId: b.id, ref: b.ref, name: b.full_name, boat: b.boats?.code ?? "?", night: b.night_date, href: `/admin/bookings/${b.id}` };
    if (b.status === "cancelled") {
      if (refundOwed(b) > 0) out.push({ ...base, key: `${b.id}-rf`, icon: "undo", tone: "red", text: `Refund ${rm(refundOwed(b))} still to pay`, money: true });
      continue;
    }
    if (b.status === "pending" || b.status === "deposit_due") {
      out.push({ ...base, key: `${b.id}-un`, icon: "card", tone: "red", text: "Trip date passed but never paid: cancel or mark the outcome", money: true });
      continue;
    }
    if (b.status !== "confirmed") continue;
    if (!b.trip_outcome) out.push({ ...base, key: `${b.id}-oc`, icon: "fish", tone: "gold", text: "Mark completed or no-show" });
    if (jettyBalance(b) > 0) out.push({ ...base, key: `${b.id}-bal`, icon: "coins", tone: "red", text: `Balance ${rm(jettyBalance(b))} not recorded`, money: true });
    if (b.trip_outcome !== "no_show" && !b.reviewed) {
      out.push({
        ...base,
        key: `${b.id}-rv`,
        icon: "star",
        tone: "purple",
        text: b.review_request_sent_at ? "No review yet: a friendly WhatsApp nudge helps" : "Ask for a review",
      });
    }
  }
  return out.sort((a, b) => b.night.localeCompare(a.night) || toneRank(a.tone) - toneRank(b.tone));
}

function toneRank(t: Task["tone"]) {
  return { red: 0, gold: 1, teal: 2, purple: 3, green: 4 }[t];
}

/** Headline insights, most urgent first. */
export function headlineInsights(
  list: InsightBooking[],
  today: string,
  opts: { boatsActive: number; seasonEnd: string; followUps: number; blockedClash: number }
): Insight[] {
  const in7 = addDaysISO(today, 7);
  const live = list.filter((b) => LIVE.includes(b.status));
  const out: Insight[] = [];

  const unpaidSoon = live.filter((b) => !b.deposit_paid && b.night_date >= today && b.night_date <= in7);
  if (unpaidSoon.length) {
    out.push({
      icon: "flame",
      tone: "red",
      title: `${unpaidSoon.length} trip${unpaidSoon.length === 1 ? "" : "s"} this week still unpaid`,
      body: `RM${unpaidSoon.reduce((s, b) => s + upfrontAmount(b), 0).toLocaleString("en-MY")} in deposits to chase before the boats sail.`,
      href: "/admin/bookings?view=board",
      money: true,
    });
  }

  if (opts.blockedClash) {
    out.push({
      icon: "wrench",
      tone: "red",
      title: `${opts.blockedClash} booking${opts.blockedClash === 1 ? "" : "s"} on a blocked night`,
      body: "A boat was blocked on a night that already has a booking. Move or weather-hold them.",
      href: "/admin/schedule",
    });
  }

  const balanceWeek = live
    .filter((b) => b.status === "confirmed" && b.night_date >= today && b.night_date <= in7)
    .reduce((s, b) => s + jettyBalance(b), 0);
  if (balanceWeek > 0) {
    out.push({
      icon: "coins",
      tone: "gold",
      title: `RM${balanceWeek.toLocaleString("en-MY")} to collect at the jetty this week`,
      body: "Balances due before departure on this week's trips.",
      money: true,
    });
  }

  // Emptiest Friday/Saturday nights ahead, in season.
  if (opts.boatsActive > 0) {
    const weekends: Array<{ night: string; free: number }> = [];
    for (let i = 1; i <= 30; i++) {
      const n = addDaysISO(today, i);
      if (n > opts.seasonEnd) break;
      const wd = new Date(`${n}T00:00:00Z`).getUTCDay();
      if (wd !== 5 && wd !== 6) continue;
      const booked = new Set(live.filter((b) => b.night_date === n).map((b) => b.boat_id)).size;
      const free = opts.boatsActive - booked;
      if (free > 0) weekends.push({ night: n, free });
    }
    const worst = weekends.sort((a, b) => b.free - a.free || a.night.localeCompare(b.night))[0];
    if (worst) {
      out.push({
        icon: "sparkle",
        tone: "purple",
        title: `${dayName(worst.night)}: ${worst.free} of ${opts.boatsActive} boats still open`,
        body: "A weekend night with room. Follow up leads or share a last-minute deal.",
        href: `/admin/schedule?view=day&date=${worst.night}`,
      });
    }
  }

  if (opts.followUps) {
    out.push({
      icon: "chat",
      tone: "teal",
      title: `${opts.followUps} lead${opts.followUps === 1 ? "" : "s"} to follow up today`,
      body: "People who asked but have not booked. A quick WhatsApp often wins them.",
      href: "/admin/leads",
    });
  }

  const past = list.filter((b) => b.status === "confirmed" && b.night_date < today && b.night_date >= addDaysISO(today, -14));
  if (past.length) {
    const reviewed = past.filter((b) => b.reviewed).length;
    out.push({
      icon: "star",
      tone: "green",
      title: `${reviewed} of ${past.length} recent trips reviewed`,
      body: reviewed === past.length ? "Every recent group left a review. Bagus!" : "Reviews sell the next trip. Ask the rest while the catch is fresh.",
    });
  }
  return out.slice(0, 5);
}
