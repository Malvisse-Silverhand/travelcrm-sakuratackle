"use client";

import Link from "next/link";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import type { Customer } from "@/lib/admin/customers";
import DataTable, { type Column, type CsvSpec, type Filter, type Tab } from "./DataTable";
import { waNumber } from "@/lib/phone";
import styles from "../../app/admin/admin.module.css";

const TABS: Tab<Customer>[] = [
  { key: "all", label: "All", test: () => true },
  { key: "upcoming", label: "Upcoming trip", test: (c) => !!c.nextTrip },
  { key: "repeat", label: "Repeat (2+ trips)", test: (c) => c.trips >= 2 },
  { key: "once", label: "One trip", test: (c) => c.trips === 1 },
];

const FILTERS: Filter<Customer>[] = [{ key: "tag", allLabel: "All tags", value: (c) => c.tags }];

const SEARCH = {
  placeholder: "Search name, phone or email…",
  text: (c: Customer) => `${c.name} ${c.email ?? ""}`,
  digits: (c: Customer) => c.key,
};

const CSV: CsvSpec<Customer> = {
  filename: "customers",
  columns: [
    { header: "Name", value: (c) => c.name },
    { header: "Phone", value: (c) => c.key },
    { header: "Email", value: (c) => c.email },
    { header: "Trips", value: (c) => c.trips },
    { header: "Cancelled", value: (c) => c.cancelled },
    { header: "Last trip", value: (c) => c.lastTrip },
    { header: "Next trip", value: (c) => c.nextTrip },
    { header: "Booking value (RM)", value: (c) => c.value },
    { header: "Paid (RM)", value: (c) => c.depositsPaid },
    { header: "First booked", value: (c) => c.firstBooked?.slice(0, 10) },
    { header: "Tags", value: (c) => (c.tags ?? []).join("; ") },
  ],
};

const COLUMNS: Column<Customer>[] = [
  {
    key: "customer",
    header: "Customer",
    render: (c) => (
      <>
        <span className={styles.dtStrong} data-pii="name">{c.name}</span>
        {c.tags && c.tags.length > 0 && (
          <span className={styles.tagRow}>
            {c.tags.map((t) => (
              <span key={t} className={`${styles.tagChip} ${t === "Do not book" ? styles.tagChipWarn : ""}`}>
                {t}
              </span>
            ))}
          </span>
        )}
        <span className={styles.dtSub}>
          <span data-pii="phone">{c.key}</span>
          {c.email && (
            <>
              {" · "}
              <span data-pii="email">{c.email}</span>
            </>
          )}
        </span>
      </>
    ),
  },
  {
    key: "trips",
    header: "Trips",
    align: "right",
    render: (c) => (
      <>
        {c.trips}
        {c.cancelled > 0 && <span className={styles.dtSub}>{c.cancelled} cancelled</span>}
      </>
    ),
  },
  { key: "last", header: "Last trip", render: (c) => (c.lastTrip ? formatLongDate(c.lastTrip) : "—") },
  { key: "next", header: "Next trip", render: (c) => (c.nextTrip ? formatLongDate(c.nextTrip) : "—") },
  { key: "value", header: "Booked value", align: "right", render: (c) => formatRM(c.value) },
  { key: "paid", header: "Deposits paid", align: "right", render: (c) => formatRM(c.depositsPaid) },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (c) => (
      <div className={styles.dtActions}>
        <Link href={`/admin/customers/${c.key}`} className={`${styles.dtBtn} ${styles.dtBtnView}`}>
          View
        </Link>
        <a
          href={`https://wa.me/${waNumber(c.key)}`}
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

export default function CustomersTable({ rows }: { rows: Customer[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(c) => c.key}
      columns={COLUMNS}
      tabs={TABS}
      filters={FILTERS}
      search={SEARCH}
      csv={CSV}
      emptyText="No customers match."
    />
  );
}
