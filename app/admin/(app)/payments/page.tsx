import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import PaymentsTable, { type PaymentRow } from "@/components/admin/PaymentsTable";
import ReceiptsLedger, { type LedgerRow } from "@/components/admin/receipts/ReceiptsLedger";
import { formatRM } from "@/lib/date";
import styles from "../../admin.module.css";
import board from "@/components/admin/board/board.module.css";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const profile = await requireAdmin();
  const { view } = await searchParams;
  const ledger = view === "receipts";

  const supabase = await createClient();
  const [{ data }, { data: receipts }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, ref, full_name, phone, status, night_date, deposit_amount, total_amount, pay_plan, deposit_paid, deposit_paid_at, receipt_url, boats(code)"
      )
      .neq("status", "cancelled")
      .order("night_date"),
    supabase
      .from("payments")
      .select(
        "id, booking_id, kind, amount, method, paid_at, proof_path, note, receipt_no, receipt_token, voided_at, void_reason, emailed_at, whatsapped_at, bookings(ref, full_name, email)"
      )
      .order("paid_at", { ascending: false })
      .limit(2000),
  ]);

  const rows = (data ?? []) as unknown as PaymentRow[];
  const waiting = rows.filter((r) => r.receipt_url && !r.deposit_paid).length;
  const ledgerRows = (receipts ?? []) as unknown as LedgerRow[];
  const net = ledgerRows.filter((p) => !p.voided_at).reduce((s, p) => s + (p.kind === "refund" ? -Number(p.amount) : Number(p.amount)), 0);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={
          ledger
            ? `${ledgerRows.filter((p) => !p.voided_at).length} receipts · ${formatRM(net)} net received`
            : waiting > 0
              ? `${waiting} receipt${waiting === 1 ? "" : "s"} to verify`
              : "No receipts waiting"
        }
        avatarInitials={profile.initials}
        actions={
          <span className={board.viewToggle}>
            <Link href="/admin/payments" className={ledger ? "" : board.viewOn} aria-current={ledger ? undefined : "page"}>
              To verify
            </Link>
            <Link href="/admin/payments?view=receipts" className={ledger ? board.viewOn : ""} aria-current={ledger ? "page" : undefined}>
              Receipts
            </Link>
          </span>
        }
      />
      <div className={styles.main}>{ledger ? <ReceiptsLedger rows={ledgerRows} /> : <PaymentsTable rows={rows} />}</div>
    </>
  );
}
