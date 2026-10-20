import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import CustomersTable from "@/components/admin/CustomersTable";
import Link from "next/link";
import {
  groupCustomers,
  mergeHistory,
  type CustomerBooking,
  type ImportedCustomer,
  type PastTrip,
} from "@/lib/admin/customers";
import { todayISO } from "@/lib/date";
import styles from "../../admin.module.css";

export default async function CustomersPage() {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const [{ data }, { data: notes }, { data: imported }, { data: past }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, email, status, night_date, pax, price_per_pax, total_amount, deposit_amount, deposit_paid, pay_plan, created_at, boats(code)"
      ),
    supabase.from("customer_notes").select("phone_key, tags"),
    supabase.from("customers").select("phone_key, name, email, tags"),
    supabase.from("past_trips").select("phone_key, trip_date, boat_label, pax, amount, note"),
  ]);

  const tagsOf = new Map((notes ?? []).map((n) => [n.phone_key, n.tags as string[]]));
  const fromImport = new Map((imported ?? []).map((c) => [c.phone_key, (c.tags as string[] | null) ?? []]));
  const customers = mergeHistory(
    groupCustomers((data ?? []) as unknown as CustomerBooking[], todayISO()),
    (imported ?? []) as ImportedCustomer[],
    (past ?? []) as PastTrip[]
  ).map((c) => ({
    ...c,
    tags: Array.from(new Set([...(tagsOf.get(c.key) ?? []), ...(fromImport.get(c.key) ?? [])])),
  }));

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"}, matched by phone number`}
        avatarInitials={profile.initials}
        actions={
          <Link href="/admin/customers/import" className={styles.headerActionBtn}>
            Import from Google Sheets
          </Link>
        }
      />
      <div className={styles.main}>
        <CustomersTable rows={customers} />
      </div>
    </>
  );
}
