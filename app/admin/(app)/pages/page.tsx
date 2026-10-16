import { createClient } from "@/lib/supabase/server";
import { requirePageEditor } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import PagesTable, { type PageListRow } from "@/components/admin/pages/PagesTable";
import { SITE_URL } from "@/lib/site-url";
import styles from "../../admin.module.css";

export default async function PagesPage() {
  const profile = await requirePageEditor();
  const supabase = await createClient();
  const [{ data: pages }, { data: people }] = await Promise.all([
    supabase
      .from("site_pages")
      .select("id, slug, title, status, updated_at, published_at, updated_by")
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const rows: PageListRow[] = (pages ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    updated_at: p.updated_at,
    published_at: p.published_at,
    editor: (p.updated_by && nameOf.get(p.updated_by)) || "—",
  }));
  const live = rows.filter((r) => r.status === "published").length;

  return (
    <>
      <PageHeader
        title="Pages"
        subtitle={`${rows.length} page${rows.length === 1 ? "" : "s"}, ${live} live`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <PagesTable rows={rows} siteUrl={SITE_URL} />
      </div>
    </>
  );
}
