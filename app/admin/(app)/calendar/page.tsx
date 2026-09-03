import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CalendarManager from "@/components/admin/CalendarManager";
import { isoDate, monthLabel, MONTHS } from "@/lib/season";
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
        .gte("night_date", isoDate(0, 1))
        .lte("night_date", isoDate(0, MONTHS[0].days))
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
            initialMonthIdx={0}
            initialMonthLabel={monthLabel(0)}
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
