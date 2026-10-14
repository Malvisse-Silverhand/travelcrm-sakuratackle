"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import DataTable, { type Column, type Filter, type Tab } from "./DataTable";
import { STATUS_LABEL, statusPill } from "./bookingStatus";
import styles from "../../app/admin/admin.module.css";

export type PaymentRow = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  status: string;
  night_date: string;
  deposit_amount: number;
  deposit_paid: boolean;
  deposit_paid_at: string | null;
  receipt_url: string | null;
  boats: { code: string } | null;
};

const toVerify = (r: PaymentRow) => !!r.receipt_url && !r.deposit_paid;
const awaiting = (r: PaymentRow) =>
  !r.receipt_url && !r.deposit_paid && (r.status === "pending" || r.status === "deposit_due");

const TABS: Tab<PaymentRow>[] = [
  { key: "verify", label: "To verify", test: toVerify },
  { key: "awaiting", label: "Awaiting deposit", test: awaiting },
  { key: "paid", label: "Paid", test: (r) => r.deposit_paid },
  { key: "all", label: "All", test: () => true },
];

const FILTERS: Filter<PaymentRow>[] = [
  { key: "boat", allLabel: "All boats", value: (r) => r.boats?.code },
];

const SEARCH = {
  placeholder: "Search name, phone or reference…",
  text: (r: PaymentRow) => `${r.full_name} ${r.ref}`,
  digits: (r: PaymentRow) => r.phone,
};

/** Deposits: receipts customers uploaded from the Pembayaran tab, waiting
 *  for the operator to check them against the bank, plus who still owes. */
export default function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const viewReceipt = async (path: string) => {
    // The receipts bucket is private: a short-lived signed link, never a
    // public URL.
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noreferrer");
    else setMsg({ ok: false, text: "Could not open the receipt. Try again." });
  };

  const verify = async (r: PaymentRow) => {
    if (
      !window.confirm(
        `Mark the ${formatRM(Number(r.deposit_amount))} deposit for ${r.ref} (${r.full_name}) as received?`
      )
    ) {
      return;
    }
    setBusyId(r.id);
    setMsg(null);
    // Same rule as the booking page: a paid deposit confirms a pending or
    // deposit-due booking; other statuses (e.g. weather hold) are kept.
    const nextStatus = r.status === "pending" || r.status === "deposit_due" ? "confirmed" : r.status;
    const { data, error } = await supabase
      .from("bookings")
      .update({ deposit_paid: true, deposit_paid_at: new Date().toISOString(), status: nextStatus })
      .eq("id", r.id)
      .eq("deposit_paid", false)
      .select("id");
    setBusyId(null);
    // RLS no-ops return no error, so an empty result is a failure too.
    if (error || !data?.length) {
      setMsg({ ok: false, text: `${r.ref} was not updated. Refresh — it may already be paid.` });
      return;
    }
    setMsg({ ok: true, text: `${r.ref}: deposit received, booking ${STATUS_LABEL[nextStatus].toLowerCase()}.` });
    router.refresh();
  };

  const columns: Column<PaymentRow>[] = [
    { key: "ref", header: "Ref", render: (r) => <span className={styles.dtStrong}>{r.ref}</span> },
    {
      key: "customer",
      header: "Customer",
      render: (r) => (
        <>
          <span className={styles.dtStrong}>{r.full_name}</span>
          <span className={styles.dtSub}>{r.phone}</span>
        </>
      ),
    },
    {
      key: "night",
      header: "Night",
      render: (r) => (
        <>
          {formatLongDate(r.night_date)}
          <span className={styles.dtSub}>{r.boats?.code ?? "—"}</span>
        </>
      ),
    },
    {
      key: "deposit",
      header: "Deposit",
      align: "right",
      render: (r) => formatRM(Number(r.deposit_amount)),
    },
    {
      key: "receipt",
      header: "Receipt",
      render: (r) =>
        r.receipt_url ? (
          <button
            type="button"
            className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
            onClick={() => viewReceipt(r.receipt_url!)}
          >
            View receipt
          </button>
        ) : (
          <span className={styles.dtSub}>None yet</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <>
          <span className={statusPill(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</span>
          {r.deposit_paid && r.deposit_paid_at && (
            <span className={styles.dtSub}>Paid {formatLongDate(r.deposit_paid_at.slice(0, 10))}</span>
          )}
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <div className={styles.dtActions}>
          {!r.deposit_paid && r.status !== "cancelled" && (
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnOk}`}
              disabled={busyId !== null}
              onClick={() => verify(r)}
            >
              {busyId === r.id ? "Saving…" : "Verify"}
            </button>
          )}
          <Link href={`/admin/bookings/${r.id}`} className={`${styles.dtBtn} ${styles.dtBtnView}`}>
            View
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      {msg && (
        <p className={msg.ok ? styles.formOk : styles.formErr} style={{ margin: "0 0 12px" }}>
          {msg.text}
        </p>
      )}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        tabs={TABS}
        filters={FILTERS}
        search={SEARCH}
        emptyText="Nothing here. New receipts appear as customers upload them."
      />
    </>
  );
}
