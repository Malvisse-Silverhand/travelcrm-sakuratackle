import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CalendarManager from "@/components/admin/CalendarManager";
import {
  FALLBACK_SEASON,
  currentMonthIdxIn,
  monthFirstISO,
  monthLastISO,
  monthsBetween,
} from "@/lib/season";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function CalendarPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();

  const [{ data: boats }, { data: pkg }] = await Promise.all([
    supabase
      .from("boats")
      .select("id, code, skipper_name, capacity")
      .eq("active", true)
      .order("code"),
    supabase
      .from("packages")
      .select("id, season_start, season_end")
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  // Every month of the season set in Settings, closed ones included, so the
  // operator can see and manage them. Opens on the current month; earlier
  // months stay reachable for history.
  const months = monthsBetween(
    pkg?.season_start ?? FALLBACK_SEASON.start,
    pkg?.season_end ?? FALLBACK_SEASON.end
  );
  const openMonthIdx = currentMonthIdxIn(months, todayISO());
  const openMonth = months[openMonthIdx];

  const firstBoat = boats?.[0];
  const { data: nights } = firstBoat
    ? await supabase
        .from("trip_night_status")
        .select("night_date, blocked, blocked_reason, capacity, pax_held, status")
        .eq("boat_id", firstBoat.id)
        .gte("night_date", monthFirstISO(openMonth))
        .lte("night_date", monthLastISO(openMonth))
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
            months={months}
            initialMonthIdx={openMonthIdx}
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
