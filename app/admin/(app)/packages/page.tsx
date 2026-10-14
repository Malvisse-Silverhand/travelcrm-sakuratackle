import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import PackagesList, { type PackageRow } from "@/components/admin/PackagesList";
import styles from "../../admin.module.css";

export default async function PackagesPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("id, slug, title, price_per_pax, season_start, season_end, published")
    .order("created_at");

  const rows = (packages ?? []) as PackageRow[];
  const publishedCount = rows.filter((p) => p.published).length;

  return (
    <>
      <PageHeader
        title="Packages and pricing"
        subtitle={`${publishedCount} published trip${publishedCount === 1 ? "" : "s"}`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <PackagesList packages={rows} />
      </div>
    </>
  );
}
