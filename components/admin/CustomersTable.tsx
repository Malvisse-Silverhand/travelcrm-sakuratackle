"use client";

import Link from "next/link";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import type { Customer } from "@/lib/admin/customers";
import DataTable, { type Column, type Tab } from "./DataTable";
import { waNumber } from "@/lib/phone";
import styles from "../../app/admin/admin.module.css";

const TABS: Tab<Customer>[] = [
  { key: "all", label: "All", test: () => true },
  { key: "upcoming", label: "Upcoming trip", test: (c) => !!c.nextTrip },
  { key: "repeat", label: "Repeat (2+ trips)", test: (c) => c.trips >= 2 },
  { key: "once", label: "One trip", test: (c) => c.trips === 1 },
];

const SEARCH = {
  placeholder: "Search name, phone or email…",
  text: (c: Customer) => `${c.name} ${c.email ?? ""}`,
  digits: (c: Customer) => c.key,
};

const COLUMNS: Column<Customer>[] = [
  {
    key: "customer",
    header: "Customer",
    render: (c) => (
      <>
        <span className={styles.dtStrong} data-pii="name">{c.name}</span>
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
      search={SEARCH}
      emptyText="No customers match."
    />
  );
}
