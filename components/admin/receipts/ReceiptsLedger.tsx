"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type CsvSpec, type Filter, type Tab } from "@/components/admin/DataTable";
import { formatRM } from "@/lib/date";
import { KIND, METHOD, openProof, paymentAction, when, type PaymentRow } from "./PaymentsCard";
import styles from "../../../app/admin/admin.module.css";

export type LedgerRow = PaymentRow & {
  booking_id: string;
  bookings: { ref: string; full_name: string; email: string | null } | null;
};

const TABS: Tab<LedgerRow>[] = [
  { key: "all", label: "All receipts", test: (p) => !p.voided_at },
  { key: "unsent", label: "Not sent yet", test: (p) => !p.voided_at && !p.emailed_at && !p.whatsapped_at },
  { key: "refund", label: "Refunds", test: (p) => p.kind === "refund" && !p.voided_at },
  { key: "void", label: "Void", test: (p) => !!p.voided_at },
];

const FILTERS: Filter<LedgerRow>[] = [
  { key: "kind", allLabel: "All types", value: (p) => KIND[p.kind] },
  { key: "method", allLabel: "All methods", value: (p) => METHOD[p.method] },
];

const CSV: CsvSpec<LedgerRow> = {
  filename: "receipts",
  columns: [
    { header: "Receipt", value: (p) => p.receipt_no },
    { header: "Paid at", value: (p) => p.paid_at },
    { header: "Type", value: (p) => KIND[p.kind] },
    { header: "Method", value: (p) => METHOD[p.method] },
    { header: "Amount (RM)", value: (p) => (p.kind === "refund" ? -Number(p.amount) : Number(p.amount)) },
    { header: "Booking", value: (p) => p.bookings?.ref },
    { header: "Customer", value: (p) => p.bookings?.full_name },
    { header: "Note", value: (p) => p.note },
    { header: "Void", value: (p) => (p.voided_at ? p.void_reason ?? "Yes" : "") },
  ],
};

/** Every receipt issued, newest first: the record of money in and out,
 *  with proof files and sending. */
export default function ReceiptsLedger({ rows }: { rows: LedgerRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (p: LedgerRow, channel: "email" | "whatsapp") => {
    setMsg(null);
    const win = channel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const { ok, json } = await paymentAction(p.id, { action: channel });
    if (!ok) {
      win?.close();
      return setMsg({ ok: false, text: `${p.receipt_no}: ${json.error ?? "Not sent."}` });
    }
    if (win && json.link) win.location.href = json.link;
    setMsg({ ok: true, text: `${p.receipt_no}: ${channel === "email" ? "emailed." : "WhatsApp opened."}` });
    router.refresh();
  };

  const columns: Column<LedgerRow>[] = [
    {
      key: "no",
      header: "Receipt",
      render: (p) => (
        <>
          <span className={styles.dtStrong} style={p.voided_at ? { textDecoration: "line-through" } : undefined}>
            {p.receipt_no}
          </span>
          <span className={styles.dtSub}>{when(p.paid_at)}</span>
        </>
      ),
    },
    {
      key: "booking",
      header: "Booking",
      render: (p) => (
        <>
          <Link href={`/admin/bookings/${p.booking_id}`} className={styles.dtStrong} data-pii="name">
            {p.bookings?.full_name ?? "—"}
          </Link>
          <span className={styles.dtSub}>{p.bookings?.ref}</span>
        </>
      ),
    },
    { key: "kind", header: "Type", render: (p) => `${KIND[p.kind] ?? p.kind} · ${METHOD[p.method] ?? p.method}` },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => `${p.kind === "refund" ? "−" : ""}${formatRM(Number(p.amount))}`,
    },
    {
      key: "sent",
      header: "Sent",
      render: (p) =>
        p.voided_at ? (
          <span className={styles.dtSub} style={{ color: "var(--danger-text)" }}>
            Void: {p.void_reason}
          </span>
        ) : (
          [p.emailed_at ? "Email" : null, p.whatsapped_at ? "WhatsApp" : null].filter(Boolean).join(" + ") || "—"
        ),
    },
    {
      key: "act",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className={styles.dtActions}>
          <a href={`/receipt/${p.receipt_token}`} target="_blank" rel="noopener noreferrer" className={`${styles.dtBtn} ${styles.dtBtnView}`}>
            View
          </a>
          {p.proof_path && (
            <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => openProof(p.proof_path!)}>
              Proof
            </button>
          )}
          {!p.voided_at && (
            <>
              <button
                type="button"
                className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
                disabled={!p.bookings?.email}
                title={p.bookings?.email ? "" : "No email on this booking"}
                onClick={() => send(p, "email")}
              >
                Email
              </button>
              <button type="button" className={`${styles.dtBtn} ${styles.dtBtnWa}`} onClick={() => send(p, "whatsapp")}>
                WhatsApp
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {msg && (
        <p className={msg.ok ? styles.formOk : styles.formErr} style={{ margin: "0 0 10px" }}>
          {msg.text}
        </p>
      )}
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        columns={columns}
        tabs={TABS}
        filters={FILTERS}
        search={{
          placeholder: "Search receipt no., name or booking ref…",
          text: (p) => `${p.receipt_no} ${p.bookings?.full_name ?? ""} ${p.bookings?.ref ?? ""}`,
        }}
        csv={CSV}
        emptyText="No receipts yet."
      />
    </>
  );
}
