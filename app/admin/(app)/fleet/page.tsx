import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import FleetTable, { type FleetRow } from "@/components/admin/FleetTable";
import { LIVE_STATUSES } from "@/components/admin/bookingStatus";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function FleetPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const [{ data: boats }, { data: upcoming }] = await Promise.all([
    supabase
      .from("boats")
      .select(
        "id, code, display_name, kind, skipper_name, capacity, length_ft, daily_rate, photo_url, active, sort_order"
      )
      .order("sort_order")
      .order("code"),
    supabase
      .from("bookings")
      .select("boat_id")
      .in("status", LIVE_STATUSES)
      .gte("night_date", todayISO()),
  ]);

  const perBoat = new Map<string, number>();
  for (const b of upcoming ?? []) perBoat.set(b.boat_id, (perBoat.get(b.boat_id) ?? 0) + 1);

  const rows: FleetRow[] = (boats ?? []).map((b) => ({ ...b, upcoming: perBoat.get(b.id) ?? 0 }));
  const active = rows.filter((b) => b.active).length;

  return (
    <>
      <PageHeader
        title="Fleet"
        subtitle={`${active} active boat${active === 1 ? "" : "s"} of ${rows.length}`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <FleetTable rows={rows} />
      </div>
    </>
  );
}
