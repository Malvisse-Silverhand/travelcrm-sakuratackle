import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import SettingsPanel from "@/components/admin/SettingsPanel";
import styles from "../../admin.module.css";

export default async function SettingsPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const [{ data: boats }, { data: org }, { data: pkg }] = await Promise.all([
    supabase
      .from("boats")
      .select("id, code, skipper_name, capacity, active")
      .order("code"),
    supabase
      .from("org_settings")
      .select("business_name, location, whatsapp_number")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("packages")
      .select("deposit_per_boat, season_start, season_end")
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Sakura Tackle operator"
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <SettingsPanel
          boats={boats ?? []}
          whatsappNumber={org?.whatsapp_number ?? ""}
          depositPerBoat={pkg?.deposit_per_boat ?? 250}
          seasonStart={pkg?.season_start ?? null}
          seasonEnd={pkg?.season_end ?? null}
        />
      </div>
    </>
  );
}
