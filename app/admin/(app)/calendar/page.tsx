import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CalendarManager from "@/components/admin/CalendarManager";
import { currentMonthIdx, isoDate, monthLabel, MONTHS } from "@/lib/season";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function CalendarPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();

  // Opens on the first month with sellable nights rather than Mac 2026, which
  // is entirely past. The operator can still page backwards for history.
  const openMonthIdx = currentMonthIdx(todayISO());

  const [{ data: boats }, { data: pkg }] = await Promise.all([
    supabase
      .from("boats")
      .select("id, code, skipper_name, capacity")
      .eq("active", true)
      .order("code"),
    supabase
      .from("packages")
      .select("id")
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  const firstBoat = boats?.[0];
  const { data: nights } = firstBoat
    ? await supabase
        .from("trip_night_status")
        .select("night_date, blocked, blocked_reason, capacity, pax_held, status")
        .eq("boat_id", firstBoat.id)
        .gte("night_date", isoDate(openMonthIdx, 1))
        .lte("night_date", isoDate(openMonthIdx, MONTHS[openMonthIdx].days))
        .order("night_date")
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Slot manager"
        subtitle={firstBoat ? `${firstBoat.code} availability` : "No active boats"}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        {boats && boats.length > 0 ? (
          <CalendarManager
            boats={boats}
            initialBoatId={firstBoat!.id}
            initialMonthIdx={openMonthIdx}
            initialMonthLabel={monthLabel(openMonthIdx)}
            initialNights={nights ?? []}
            packageId={pkg?.id ?? null}
          />
        ) : (
          <div className={styles.emptyCard}>
            <p className={styles.emptyCardTitle}>Tiada bot aktif</p>
            <p className={styles.emptyCardBody}>
              Tambah bot dalam Settings sebelum mengurus slot.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
