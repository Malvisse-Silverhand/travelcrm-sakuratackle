import { redirect } from "next/navigation";
import { getOperatorProfile } from "@/lib/admin/operator";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/admin/Sidebar";
import BottomNav from "@/components/admin/BottomNav";
import styles from "../admin.module.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth alongside the proxy — see lib/supabase/proxy.ts. The
  // login page itself lives outside this layout (app/admin/login/page.tsx),
  // so every route reaching here is expected to be an authenticated operator.
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  // Sidebar badges: new leads, and uploaded receipts nobody has checked.
  const supabase = await createClient();
  const [{ count: pending }, { count: receipts }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .not("receipt_url", "is", null)
      .eq("deposit_paid", false)
      .neq("status", "cancelled"),
  ]);

  return (
    <div className={styles.shell}>
      <Sidebar badges={{ pending: pending ?? 0, receipts: receipts ?? 0 }} />
      <div className={styles.contentColumn}>
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
