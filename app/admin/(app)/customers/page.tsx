import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CustomersTable from "@/components/admin/CustomersTable";
import { groupCustomers, type CustomerBooking } from "@/lib/admin/customers";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function CustomersPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const [{ data }, { data: notes }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, created_at, boats(code)"
      ),
    supabase.from("customer_notes").select("phone_key, tags"),
  ]);

  const tagsOf = new Map((notes ?? []).map((n) => [n.phone_key, n.tags as string[]]));
  const customers = groupCustomers((data ?? []) as unknown as CustomerBooking[], todayISO()).map((c) => ({
    ...c,
    tags: tagsOf.get(c.key) ?? [],
  }));

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
