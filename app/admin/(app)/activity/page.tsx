import { requireAdmin } from "@/lib/admin/operator";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import ActivityTable, { type ActivityRow } from "@/components/admin/ActivityTable";
import styles from "../../admin.module.css";

export default async function ActivityPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, at, actor_name, action, entity, entity_id, summary")
    .order("at", { ascending: false })
    .limit(500);

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Who changed what, newest first (last 500)"
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <ActivityTable rows={(data ?? []) as ActivityRow[]} />
      </div>
    </>
  );
}
