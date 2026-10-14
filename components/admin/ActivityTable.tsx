"use client";

import Link from "next/link";
import DataTable, { type Column, type Filter, type Tab } from "./DataTable";
import styles from "../../app/admin/admin.module.css";

export type ActivityRow = {
  id: number;
  at: string;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
};

const TABS: Tab<ActivityRow>[] = [
  { key: "all", label: "All", test: () => true },
  { key: "booking", label: "Bookings", test: (r) => r.entity === "booking" && r.action !== "payment.verified" },
  { key: "payment", label: "Payments", test: (r) => r.action === "payment.verified" },
  { key: "boat", label: "Fleet", test: (r) => r.entity === "boat" },
  { key: "package", label: "Season & prices", test: (r) => r.entity === "package" },
  { key: "user", label: "Team", test: (r) => r.entity === "user" },
  { key: "customer", label: "Customers", test: (r) => r.entity === "customer" },
];

const FILTERS: Filter<ActivityRow>[] = [{ key: "who", allLabel: "Everyone", value: (r) => r.actor_name }];

const SEARCH = { placeholder: "Search what happened…", text: (r: ActivityRow) => r.summary };

const WHEN = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function linkFor(r: ActivityRow): string | null {
  if (!r.entity_id) return null;
  if (r.entity === "booking") return `/admin/bookings/${r.entity_id}`;
  if (r.entity === "boat") return `/admin/fleet/${r.entity_id}`;
  if (r.entity === "customer") return `/admin/customers/${r.entity_id}`;
  return null;
}

const COLUMNS: Column<ActivityRow>[] = [
  { key: "when", header: "When", render: (r) => WHEN.format(new Date(r.at)) },
  { key: "who", header: "Who", render: (r) => <span className={styles.dtStrong}>{r.actor_name ?? "—"}</span> },
  { key: "what", header: "What happened", render: (r) => r.summary },
  {
    key: "open",
    header: "",
    align: "right",
    render: (r) => {
      const href = linkFor(r);
      return href ? (
        <Link href={href} className={`${styles.dtBtn} ${styles.dtBtnView}`}>
          Open
        </Link>
      ) : null;
    },
  },
];

export default function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => String(r.id)}
      columns={COLUMNS}
      tabs={TABS}
      filters={FILTERS}
      search={SEARCH}
      defaultPageSize={50}
      emptyText="Nothing recorded yet. Changes appear here as they happen."
    />
  );
}
