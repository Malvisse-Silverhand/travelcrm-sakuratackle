"use client";

import Link from "next/link";
import { formatRM } from "@/lib/date";
import DataTable, { type Column, type Filter, type Tab } from "./DataTable";
import styles from "../../app/admin/admin.module.css";

export type FleetRow = {
  id: string;
  code: string;
  display_name: string | null;
  kind: string | null;
  skipper_name: string;
  capacity: number;
  length_ft: number | null;
  daily_rate: number | null;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
  /** Name of the jetty it sails from. */
  jetty: string;
  /** Live bookings on upcoming nights. */
  upcoming: number;
};

const TABS: Tab<FleetRow>[] = [
  { key: "active", label: "Active", test: (b) => b.active },
  { key: "inactive", label: "Inactive", test: (b) => !b.active },
  { key: "all", label: "All", test: () => true },
];

const FILTERS: Filter<FleetRow>[] = [
  { key: "jetty", allLabel: "All jetties", value: (b) => b.jetty },
];

const SEARCH = {
  placeholder: "Search code, name or skipper…",
  text: (b: FleetRow) => `${b.code} ${b.display_name ?? ""} ${b.skipper_name}`,
};

const COLUMNS: Column<FleetRow>[] = [
  { key: "order", header: "#", render: (b) => b.sort_order || "—" },
  {
    key: "photo",
    header: "Photo",
    render: (b) =>
      b.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.photo_url} alt="" className={styles.dtThumb} loading="lazy" />
      ) : (
        <span className={styles.dtThumb} />
      ),
  },
  {
    key: "name",
    header: "Boat",
    render: (b) => (
      <>
        <span className={styles.dtStrong}>{b.display_name ?? b.code}</span>
        <span className={styles.dtSub}>
          {b.code}
          {b.kind ? ` · ${b.kind}` : ""}
        </span>
      </>
    ),
  },
  { key: "jetty", header: "Jetty", render: (b) => b.jetty },
  { key: "skipper", header: "Skipper", render: (b) => b.skipper_name },
  { key: "cap", header: "Capacity", align: "right", render: (b) => `${b.capacity} pax` },
  { key: "len", header: "Length", align: "right", render: (b) => (b.length_ft ? `${b.length_ft} ft` : "—") },
  {
    key: "rate",
    header: "Daily rate",
    align: "right",
    render: (b) => (b.daily_rate !== null ? formatRM(Number(b.daily_rate)) : "—"),
  },
  { key: "upcoming", header: "Upcoming", align: "right", render: (b) => b.upcoming || "—" },
  {
    key: "status",
    header: "Status",
    render: (b) => (
      <span
        className={`${styles.manifestStatus} ${b.active ? styles.statusConfirmed : styles.statusPending}`}
      >
        {b.active ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    render: (b) => (
      <div className={styles.dtActions}>
        <Link href={`/admin/fleet/${b.id}`} className={`${styles.dtBtn} ${styles.dtBtnEdit}`}>
          Edit
        </Link>
      </div>
    ),
  },
];

export default function FleetTable({ rows }: { rows: FleetRow[] }) {
  return (
    <DataTable
      filters={FILTERS}
      rows={rows}
      rowKey={(b) => b.id}
      columns={COLUMNS}
      tabs={TABS}
      search={SEARCH}
      defaultPageSize={50}
      emptyText="No boats here."
      toolbarEnd={
        <Link href="/admin/fleet/new" className={styles.dtAddBtn}>
          Add boat
        </Link>
      }
    />
  );
}
