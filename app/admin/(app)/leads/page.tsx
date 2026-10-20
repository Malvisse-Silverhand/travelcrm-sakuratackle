import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import LeadsBoard from "@/components/admin/leads/LeadsBoard";
import { followUpDue, isOpen, type Lead } from "@/lib/leads";
import { firstOfMonthISO, todayISO } from "@/lib/date";
import styles from "../../admin.module.css";
import board from "@/components/admin/board/board.module.css";

// Leads: people who asked but have not booked, from manual key-in, expired
// website holds and Google Sheet imports.

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const profile = await requireAdmin();
  const { view } = await searchParams;
  const list = view === "list";
  const today = todayISO();

  const supabase = await createClient();
  const [{ data: rows }, { data: boats }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, email, source, wanted_date, pax, boat_id, budget, notes, stage, lost_reason, next_follow_up, booking_id, created_at, stage_changed_at, bookings!leads_booking_id_fkey(total_amount)"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("boats").select("id, code").eq("active", true).order("sort_order").order("code"),
  ]);

  const leads: Lead[] = (rows ?? []).map((r) => {
    const bk = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings;
    return { ...r, won_amount: (bk as { total_amount?: number } | null)?.total_amount ?? null } as Lead;
  });
  const open = leads.filter(isOpen).length;
  const due = leads.filter((l) => followUpDue(l, today)).length;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${open} open${due ? ` · ${due} to follow up today` : ""}`}
        avatarInitials={profile.initials}
        actions={
          <span className={board.viewToggle}>
            <Link href="/admin/leads" className={list ? "" : board.viewOn} aria-current={list ? undefined : "page"}>
              Board
            </Link>
            <Link href="/admin/leads?view=list" className={list ? board.viewOn : ""} aria-current={list ? "page" : undefined}>
              List
            </Link>
          </span>
        }
      />
      <div className={styles.main}>
        <LeadsBoard leads={leads} boats={boats ?? []} today={today} monthStart={firstOfMonthISO(today)} view={list ? "list" : "board"} />
      </div>
    </>
  );
}
