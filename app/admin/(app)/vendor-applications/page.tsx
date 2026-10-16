import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import VendorApplications, { type ApplicationRow } from "@/components/admin/VendorApplications";
import styles from "../../admin.module.css";

export default async function VendorApplicationsPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const [{ data: apps }, { data: boats }] = await Promise.all([
    supabase
      .from("vendor_applications")
      .select(
        "id, full_name, business_name, email, phone, jetty, boat_count, boat_details, message, source_page, status, admin_note, created_at, reviewed_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("boats").select("id, code").eq("active", true).is("vendor_id", null).order("sort_order").order("code"),
  ]);

  const rows: ApplicationRow[] = (apps ?? []).map((a) => ({
    id: a.id,
    name: a.full_name,
    business: a.business_name,
    email: a.email,
    phone: a.phone,
    jetty: a.jetty,
    boatCount: a.boat_count,
    boatDetails: a.boat_details,
    message: a.message,
    source: a.source_page,
    status: a.status,
    note: a.admin_note,
    createdAt: a.created_at,
    reviewedAt: a.reviewed_at,
  }));
  const fresh = rows.filter((r) => r.status === "new").length;

  return (
    <>
      <PageHeader
        title="Vendor applications"
        subtitle={fresh ? `${fresh} waiting for review` : "Boat owners who applied to join"}
        avatarInitials={profile.initials}
        actions={
          <Link href="/jadi-vendor" target="_blank" className={styles.headerActionBtn}>
            View signup page
          </Link>
        }
      />
      <div className={styles.main}>
        <VendorApplications rows={rows} freeBoats={boats ?? []} />
      </div>
    </>
  );
}
