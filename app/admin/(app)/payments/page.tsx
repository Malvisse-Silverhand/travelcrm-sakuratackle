import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import PaymentsTable, { type PaymentRow } from "@/components/admin/PaymentsTable";
import styles from "../../admin.module.css";

export default async function PaymentsPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, ref, full_name, phone, status, night_date, deposit_amount, deposit_paid, deposit_paid_at, receipt_url, boats(code)"
    )
    .neq("status", "cancelled")
    .order("night_date");

  const rows = (data ?? []) as unknown as PaymentRow[];
  const waiting = rows.filter((r) => r.receipt_url && !r.deposit_paid).length;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={
          waiting > 0
            ? `${waiting} receipt${waiting === 1 ? "" : "s"} to verify`
            : "No receipts waiting"
        }
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <PaymentsTable rows={rows} />
      </div>
    </>
  );
}
