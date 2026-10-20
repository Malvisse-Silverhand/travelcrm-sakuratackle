import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import ImportWizard, { type BatchRow } from "@/components/admin/import/ImportWizard";
import styles from "../../../admin.module.css";

// Import old customers (with past trips) or leads from a Google Sheet.

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ into?: string }> }) {
  const profile = await requireAdmin();
  const { into } = await searchParams;

  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, kind, file_label, rows_total, rows_added, rows_merged, rows_skipped, trips_added, undone_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader
        title="Import from Google Sheets"
        subtitle="Old customers with their trips, or a list of leads"
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <ImportWizard initialKind={into === "leads" ? "leads" : "customers"} batches={(batches ?? []) as BatchRow[]} />
      </div>
    </>
  );
}
