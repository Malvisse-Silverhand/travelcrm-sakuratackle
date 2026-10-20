import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import SettingsPanel from "@/components/admin/SettingsPanel";
import JettySettings, { type JettyRow } from "@/components/admin/JettySettings";
import BusinessDetails from "@/components/admin/BusinessDetails";
import styles from "../../admin.module.css";

export default async function SettingsPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const [{ data: boats }, { data: org }, { data: pkg }, { data: jetties }] = await Promise.all([
    supabase
      .from("boats")
      .select("id, code, skipper_name, capacity, active, jetty_id")
      .order("code"),
    supabase
      .from("org_settings")
      .select("business_name, location, whatsapp_number, hold_hours, legal_name, ssm_no, sst_no, address, business_email")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("packages")
      .select("id, deposit_per_boat, season_start, season_end")
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("jetties")
      .select("id, name, subtitle, lat, lng, open, sort_order")
      .order("sort_order"),
  ]);

  const jettyRows: JettyRow[] = (jetties ?? []).map((j) => ({
    ...j,
    boats: (boats ?? []).filter((b) => b.active && b.jetty_id === j.id).length,
  }));

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
          holdHours={org?.hold_hours ?? 48}
          packageId={pkg?.id ?? null}
          depositPerBoat={pkg?.deposit_per_boat ?? 250}
          seasonStart={pkg?.season_start ?? null}
          seasonEnd={pkg?.season_end ?? null}
        />
        <div style={{ marginTop: 18 }}>
          <BusinessDetails
            initial={{
              business_name: org?.business_name ?? "Sakura Tackle",
              legal_name: org?.legal_name ?? null,
              ssm_no: org?.ssm_no ?? null,
              sst_no: org?.sst_no ?? null,
              address: org?.address ?? null,
              business_email: org?.business_email ?? null,
            }}
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <JettySettings jetties={jettyRows} />
        </div>
      </div>
    </>
  );
}
