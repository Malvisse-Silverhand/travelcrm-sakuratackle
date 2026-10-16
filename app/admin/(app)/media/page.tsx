import { createClient } from "@/lib/supabase/server";
import { requirePageEditor } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import MediaLibrary, { type MediaRow } from "@/components/admin/pages/MediaLibrary";
import styles from "../../admin.module.css";

export default async function MediaPage() {
  const profile = await requirePageEditor();
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_media")
    .select("id, path, url, alt, width, height, bytes, created_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as MediaRow[];

  return (
    <>
      <PageHeader title="Media" subtitle={`${rows.length} image${rows.length === 1 ? "" : "s"} for your pages`} avatarInitials={profile.initials} />
      <div className={styles.main}>
        <MediaLibrary rows={rows} />
      </div>
    </>
  );
}
