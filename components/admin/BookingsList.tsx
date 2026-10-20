"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import DataTable, { downloadCsv, type Column, type CsvSpec, type Filter, type Tab } from "./DataTable";
import { STATUS_LABEL, statusPill } from "./bookingStatus";
import BookingActions from "./bookingActions/BookingActions";
import type { MoveBoat } from "./bookingActions/MoveDialog";
import { paymentSummary, refundOwed } from "@/lib/booking/actions";
import styles from "../../app/admin/admin.module.css";

export type BookingListRow = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: "pending" | "confirmed" | "deposit_due" | "weather_hold" | "cancelled";
  night_date: string;
  pax: number;
  price_per_pax: number;
  total_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  pay_plan: string | null;
  receipt_url: string | null;
  source: string | null;
  balance_paid: boolean;
  trip_outcome: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  boat_id: string;
  boats: { code: string } | null;
};

const SOURCE: Record<string, string> = { website: "Web", whatsapp: "WhatsApp", phone: "Phone", walk_in: "Walk-in", other: "Other" };
const OUTCOME: Record<string, string> = { completed: "Completed", no_show: "No-show" };

/** "60139544778" and "0139544778" are the same Malaysian number; show the
 *  local form everywhere. */
function localPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.startsWith("60") ? "0" + d.slice(2) : d;
}

const CSV: CsvSpec<BookingListRow> = {
  filename: "bookings",
  columns: [
    { header: "Reference", value: (b) => b.ref },
    { header: "Customer", value: (b) => b.full_name },
    { header: "Phone", value: (b) => localPhone(b.phone) },
    { header: "Night", value: (b) => b.night_date },
    { header: "Boat", value: (b) => b.boats?.code },
    { header: "Pax", value: (b) => b.pax },
    { header: "Total (RM)", value: (b) => Number(b.total_amount) },
    { header: "Status", value: (b) => STATUS_LABEL[b.status] ?? b.status },
    { header: "Outcome", value: (b) => (b.trip_outcome ? OUTCOME[b.trip_outcome] : "") },
    { header: "Paid up front", value: (b) => (b.deposit_paid ? "Yes" : "No") },
    { header: "Balance collected", value: (b) => (b.balance_paid ? "Yes" : "No") },
    { header: "Refund (RM)", value: (b) => (b.refund_amount ? Number(b.refund_amount) : "") },
    { header: "Source", value: (b) => SOURCE[b.source ?? "website"] ?? b.source },
  ],
};

function needsAction(r: BookingListRow, today: string): boolean {
  if (r.status === "pending" || r.status === "deposit_due" || r.status === "weather_hold") return true;
  if (r.status === "cancelled") return refundOwed(r) > 0;
  if (r.receipt_url && !r.deposit_paid) return true;
  return r.status === "confirmed" && r.night_date < today && !r.trip_outcome;
}

function tabs(today: string): Tab<BookingListRow>[] {
  return [
    { key: "upcoming", label: "Upcoming", test: (r) => r.status !== "cancelled" && r.night_date >= today },
    { key: "action", label: "Needs action", test: (r) => needsAction(r, today) },
    { key: "past", label: "Past", test: (r) => r.status !== "cancelled" && r.night_date < today },
    { key: "all", label: "All", test: () => true },
    ...["pending", "deposit_due", "confirmed", "weather_hold", "cancelled"].map((s) => ({
      key: s,
      label: STATUS_LABEL[s],
      test: (r: BookingListRow) => r.status === s,
    })),
  ];
}

const FILTERS: Filter<BookingListRow>[] = [
  { key: "boat", allLabel: "All boats", value: (r) => r.boats?.code },
  { key: "source", allLabel: "All sources", value: (r) => SOURCE[r.source ?? "website"] },
];

const SEARCH = {
  placeholder: "Search name, phone or reference…",
  text: (r: BookingListRow) => `${r.full_name} ${r.ref}`,
  digits: (r: BookingListRow) => `${r.phone} ${localPhone(r.phone)}`,
};

const BULK = [
  { action: "weather_hold", label: "Weather hold" },
  { action: "complete", label: "Mark completed" },
  { action: "no_show", label: "No-show" },
] as const;

export default function BookingsList({ rows, boats, today }: { rows: BookingListRow[]; boats: MoveBoat[]; today: string }) {
  const router = useRouter();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  const columns: Column<BookingListRow>[] = [
    { key: "ref", header: "Ref", render: (b) => <span className={styles.dtStrong}>{b.ref}</span> },
    {
      key: "customer",
      header: "Customer",
      render: (b) => (
        <>
          <span className={styles.dtStrong} data-pii="name">
            {b.full_name}
          </span>
          <span className={styles.dtSub} data-pii="phone">
            {localPhone(b.phone)}
            {b.source && b.source !== "website" ? ` · ${SOURCE[b.source] ?? b.source}` : ""}
          </span>
        </>
      ),
    },
    { key: "night", header: "Night", render: (b) => formatLongDate(b.night_date) },
    { key: "boat", header: "Boat", render: (b) => b.boats?.code ?? "—" },
    { key: "pax", header: "Pax", align: "right", render: (b) => b.pax },
    { key: "total", header: "Total", align: "right", render: (b) => formatRM(Number(b.total_amount)) },
    {
      key: "payment",
      header: "Payment",
      render: (b) => {
        const p = paymentSummary(b, formatRM);
        return (
          <span
            className={styles.dtSub}
            style={{
              fontWeight: 600,
              color:
                p.tone === "ok" ? "var(--success-text)" : p.tone === "warn" ? "var(--warn-text)" : p.tone === "due" ? "var(--danger-text)" : undefined,
            }}
          >
            {p.text}
            {b.receipt_url && !b.deposit_paid && b.status !== "cancelled" ? " · receipt to check" : ""}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (b) => (
        <>
          <span className={statusPill(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</span>
          {b.trip_outcome && <span className={styles.dtSub}>{OUTCOME[b.trip_outcome]}</span>}
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (b) => (
        <BookingActions
          today={today}
          boats={boats}
          booking={{ ...b, boat_code: b.boats?.code ?? "?" }}
        />
      ),
    },
  ];

  const bulk = async (action: string, ids: string[], clear: () => void) => {
    if (armed !== action) {
      setArmed(action);
      return;
    }
    setArmed(null);
    setBulkBusy(true);
    setBulkMsg(null);
    const res = await fetch("/api/admin/bookings/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    const j = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) return setBulkMsg(j.error ?? "Nothing was changed. Try again.");
    setBulkMsg(`${j.done} updated${j.skipped ? `, ${j.skipped} skipped (the action does not fit them)` : ""}.`);
    clear();
    router.refresh();
  };

  return (
    <>
      {bulkMsg && <p className={styles.formOk} style={{ margin: "0 0 10px" }}>{bulkMsg}</p>}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        tabs={tabs(today)}
        filters={FILTERS}
        search={SEARCH}
        csv={CSV}
        selectable
        bulkBar={(selected, clear) => (
          <>
            <span>{selected.length} ticked</span>
            {BULK.map((x) => (
              <button
                key={x.action}
                type="button"
                className={`${styles.dtBtn} ${x.action === "no_show" ? styles.dtBtnDanger : styles.dtBtnGhost}`}
                disabled={bulkBusy}
                onClick={() => bulk(x.action, selected.map((s) => s.id), clear)}
              >
                {armed === x.action ? `Click again: ${x.label.toLowerCase()} ${selected.length}` : x.label}
              </button>
            ))}
            <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => downloadCsv(CSV, selected)}>
              Export ticked
            </button>
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
              onClick={() => {
                setArmed(null);
                clear();
              }}
            >
              Clear
            </button>
          </>
        )}
        emptyText="No bookings match. Try another tab or clear the search."
      />
    </>
  );
}
