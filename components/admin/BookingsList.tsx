"use client";

import Link from "next/link";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import DataTable, { type Column, type Filter, type Tab } from "./DataTable";
import { STATUS_LABEL, statusPill } from "./bookingStatus";
import { waNumber } from "@/lib/phone";
import styles from "../../app/admin/admin.module.css";

export type BookingListRow = {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  status: "pending" | "confirmed" | "deposit_due" | "weather_hold" | "cancelled";
  night_date: string;
  pax: number;
  price_per_pax: number;
  deposit_paid: boolean;
  boats: { code: string } | null;
};

// "All" plus every real booking_status value. Bookings genuinely start as
// `pending` (the public form and "Assign booking" both default to it), so
// the tab that reaches them must always be there.
const TABS: Tab<BookingListRow>[] = [
  { key: "all", label: "All", test: () => true },
  ...["pending", "deposit_due", "confirmed", "weather_hold", "cancelled"].map((s) => ({
    key: s,
    label: STATUS_LABEL[s],
    test: (r: BookingListRow) => r.status === s,
  })),
];

const FILTERS: Filter<BookingListRow>[] = [
  { key: "boat", allLabel: "All boats", value: (r) => r.boats?.code },
];

const SEARCH = {
  placeholder: "Search name, phone or reference…",
  text: (r: BookingListRow) => `${r.full_name} ${r.ref}`,
  digits: (r: BookingListRow) => r.phone,
};

const COLUMNS: Column<BookingListRow>[] = [
  { key: "ref", header: "Ref", render: (b) => <span className={styles.dtStrong}>{b.ref}</span> },
  {
    key: "customer",
    header: "Customer",
    render: (b) => (
      <>
        <span className={styles.dtStrong} data-pii="name">{b.full_name}</span>
        <span className={styles.dtSub} data-pii="phone">{b.phone}</span>
      </>
    ),
  },
  { key: "night", header: "Night", render: (b) => formatLongDate(b.night_date) },
  { key: "boat", header: "Boat", render: (b) => b.boats?.code ?? "—" },
  { key: "pax", header: "Pax", align: "right", render: (b) => b.pax },
  { key: "total", header: "Total", align: "right", render: (b) => formatRM(b.pax * b.price_per_pax) },
  { key: "deposit", header: "Deposit", render: (b) => (b.deposit_paid ? "Paid" : "—") },
  {
    key: "status",
    header: "Status",
    render: (b) => <span className={statusPill(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</span>,
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (b) => (
      <div className={styles.dtActions}>
        <Link href={`/admin/bookings/${b.id}`} className={`${styles.dtBtn} ${styles.dtBtnView}`}>
          View
        </Link>
        <a
          href={`https://wa.me/${waNumber(b.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.dtBtn} ${styles.dtBtnWa}`}
        >
          WhatsApp
        </a>
      </div>
    ),
  },
];

export default function BookingsList({ rows }: { rows: BookingListRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={COLUMNS}
      tabs={TABS}
      filters={FILTERS}
      search={SEARCH}
      emptyText="No bookings match. Try another tab or clear the search."
    />
  );
}
