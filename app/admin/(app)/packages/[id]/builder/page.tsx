import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import PackageBuilder from "@/components/admin/PackageBuilder";
import styles from "../../../../admin.module.css";

export default async function PackageBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("packages")
    .select(
      "id, title, subtitle, cover_image_url, price_per_pax, deposit_per_boat, includes, itinerary, faqs"
    )
    .eq("id", id)
    .maybeSingle();

  if (!pkg) notFound();

  return (
    <>
      <PageHeader title="Page builder" subtitle={pkg.title} avatarInitials={profile.initials} />
      <div className={styles.main}>
        <PackageBuilder pkg={pkg} />
      </div>
    </>
  );
}
