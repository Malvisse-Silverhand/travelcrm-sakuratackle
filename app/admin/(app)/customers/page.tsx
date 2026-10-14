import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CustomersTable from "@/components/admin/CustomersTable";
import { groupCustomers, type CustomerBooking } from "@/lib/admin/customers";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function CustomersPage() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, deposit_amount, deposit_paid, created_at, boats(code)"
    );

  const customers = groupCustomers((data ?? []) as unknown as CustomerBooking[], todayISO());

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"}, matched by phone number`}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        <CustomersTable rows={customers} />
      </div>
    </>
  );
}
