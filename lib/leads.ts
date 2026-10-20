// Leads: stages, sources and the numbers the leads board reports.

export type LeadStage = "new" | "contacted" | "quoted" | "won" | "lost";

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  wanted_date: string | null;
  pax: number | null;
  boat_id: string | null;
  budget: number | null;
  notes: string | null;
  stage: LeadStage;
  lost_reason: string | null;
  next_follow_up: string | null;
  booking_id: string | null;
  created_at: string;
  stage_changed_at: string;
  /** Total of the booking a won lead became. */
  won_amount?: number | null;
};

export const STAGES: Array<{ key: LeadStage; label: string; icon: string; tone: "grey" | "teal" | "gold" | "green" | "red" }> = [
  { key: "new", label: "New", icon: "sparkle", tone: "grey" },
  { key: "contacted", label: "Contacted", icon: "chat", tone: "teal" },
  { key: "quoted", label: "Quoted", icon: "tag", tone: "gold" },
  { key: "won", label: "Won", icon: "star", tone: "green" },
  { key: "lost", label: "Lost", icon: "undo", tone: "red" },
];

export const LEAD_SOURCES: Record<string, { label: string; icon: string }> = {
  manual: { label: "Manual", icon: "users" },
  whatsapp: { label: "WhatsApp", icon: "whatsapp" },
  phone: { label: "Phone call", icon: "broadcast" },
  facebook: { label: "Facebook", icon: "chat" },
  instagram: { label: "Instagram", icon: "sparkle" },
  walk_in: { label: "Walk-in", icon: "pin" },
  expired_hold: { label: "Website (unpaid hold)", icon: "clock" },
  import: { label: "Imported", icon: "upload" },
};

export const LOST_REASONS = ["Price", "Date full", "No reply", "Went elsewhere", "Weather", "Other"];

export function isOpen(l: Pick<Lead, "stage">): boolean {
  return l.stage !== "won" && l.stage !== "lost";
}

export function followUpDue(l: Pick<Lead, "stage" | "next_follow_up">, today: string): boolean {
  return isOpen(l) && !!l.next_follow_up && l.next_follow_up <= today;
}

/** Numbers for the leads report strip and the Reports card. */
export function leadStats(leads: Lead[], monthStart: string) {
  const month = leads.filter((l) => l.created_at.slice(0, 10) >= monthStart);
  const closed = leads.filter((l) => !isOpen(l));
  const won = leads.filter((l) => l.stage === "won");
  const bySource = new Map<string, number>();
  for (const l of month) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
  const lost = new Map<string, number>();
  for (const l of leads) if (l.stage === "lost") lost.set(l.lost_reason ?? "Other", (lost.get(l.lost_reason ?? "Other") ?? 0) + 1);
  const daysToWin = won.map((l) =>
    Math.max(0, Math.round((Date.parse(l.stage_changed_at) - Date.parse(l.created_at)) / 86_400_000))
  );
  return {
    thisMonth: month.length,
    bySource: Array.from(bySource).sort((a, b) => b[1] - a[1]),
    winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
    avgDaysToWin: daysToWin.length ? (daysToWin.reduce((s, n) => s + n, 0) / daysToWin.length).toFixed(1) : "—",
    topLost: Array.from(lost).sort((a, b) => b[1] - a[1]).slice(0, 3),
    wonAmount: won.reduce((s, l) => s + Number(l.won_amount ?? 0), 0),
    open: leads.filter(isOpen).length,
  };
}

const MONTHS_MY = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

/** First WhatsApp to a lead (bahasa rojak, like the rest of the customer
 *  copy). */
export function leadMessage(l: Pick<Lead, "name" | "wanted_date" | "pax">): string {
  const first = l.name.split(" ")[0];
  const date = l.wanted_date
    ? (() => {
        const [y, m, d] = l.wanted_date!.split("-").map(Number);
        return `${d} ${MONTHS_MY[m - 1]} ${y}`;
      })()
    : null;
  return [
    `Salam ${first}, terima kasih sebab bertanya pasal trip candat sotong dengan Sakura Tackle!`,
    "",
    date ? `Untuk ${date}${l.pax ? ` (${l.pax} orang)` : ""}, kami boleh check bot yang available sekarang.` : "Nak pergi tarikh bila, dan berapa orang?",
    "Satu bot penuh untuk group anda, kapten otai, lampu candat, makan malam disediakan.",
    "",
    "Nak saya tahan slot dulu?",
  ].join("\n");
}
