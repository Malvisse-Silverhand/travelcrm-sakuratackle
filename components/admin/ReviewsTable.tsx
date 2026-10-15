"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate } from "@/lib/season";
import DataTable, { type Column, type Filter, type Tab } from "./DataTable";
import styles from "../../app/admin/admin.module.css";

export type ReviewRow = {
  id: string;
  name: string;
  rating: number;
  comment: string | null;
  status: "pending" | "published" | "hidden";
  created_at: string;
  ref: string;
  booking_id: string;
  boat: string;
  trip_date: string;
};

const TABS: Tab<ReviewRow>[] = [
  { key: "pending", label: "To approve", test: (r) => r.status === "pending" },
  { key: "published", label: "Published", test: (r) => r.status === "published" },
  { key: "hidden", label: "Hidden", test: (r) => r.status === "hidden" },
  { key: "all", label: "All", test: () => true },
];

const FILTERS: Filter<ReviewRow>[] = [{ key: "boat", allLabel: "All boats", value: (r) => r.boat }];

const SEARCH = {
  placeholder: "Search name, reference or text…",
  text: (r: ReviewRow) => `${r.name} ${r.ref} ${r.comment ?? ""}`,
};

/** Reviews arrive pending; only published ones show on the website. */
export default function ReviewsTable({ rows }: { rows: ReviewRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setStatus = async (r: ReviewRow, status: ReviewRow["status"]) => {
    setBusy(r.id);
    setMsg(null);
    const { data, error } = await supabase
      .from("reviews")
      .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
      .eq("id", r.id)
      .select("id");
    setBusy(null);
    if (error || !data?.length) {
      setMsg({ ok: false, text: "Not updated. Reload and try again." });
      return;
    }
    setMsg({
      ok: true,
      text: `Review by ${r.name} ${status === "published" ? "is now on the website" : "is hidden"}.`,
    });
    router.refresh();
  };

  const columns: Column<ReviewRow>[] = [
    {
      key: "rating",
      header: "Rating",
      render: (r) => (
        <span className={styles.reviewStars} aria-label={`${r.rating} of 5`}>
          {"★".repeat(r.rating)}
          <span>{"★".repeat(5 - r.rating)}</span>
        </span>
      ),
    },
    {
      key: "review",
      header: "Review",
      render: (r) => (
        <div className={styles.reviewText}>
          <b>{r.name}</b>
          {r.comment ? <span>“{r.comment}”</span> : <span className={styles.requestMeta}>No comment</span>}
        </div>
      ),
    },
    { key: "boat", header: "Boat", render: (r) => r.boat },
    {
      key: "trip",
      header: "Trip",
      render: (r) => (
        <a href={`/admin/bookings/${r.booking_id}`} className={styles.dtStrong}>
          {r.ref} · {formatLongDate(r.trip_date)}
        </a>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className={styles.requestActions}>
          {r.status !== "published" && (
            <button
              type="button"
              className={styles.dtBtn}
              disabled={busy !== null}
              onClick={() => setStatus(r, "published")}
            >
              Publish
            </button>
          )}
          {r.status !== "hidden" && (
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
              disabled={busy !== null}
              onClick={() => setStatus(r, "hidden")}
            >
              Hide
            </button>
          )}
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
        defaultPageSize={20}
        emptyText="No reviews here yet. Customers are asked by email two days after their trip."
      />
    </>
  );
}
