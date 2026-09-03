import { redirect } from "next/navigation";
import { getOperatorProfile } from "@/lib/admin/operator";
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

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.contentColumn}>
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
