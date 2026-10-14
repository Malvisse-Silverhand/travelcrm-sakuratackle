"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "../../app/admin/admin.module.css";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Right-aligned numbers and the actions column. */
  align?: "right";
};

export type Tab<T> = { key: string; label: string; test: (row: T) => boolean };

export type Filter<T> = {
  key: string;
  /** Option shown first, meaning "no filter", e.g. "All boats". */
  allLabel: string;
  /** A row's value, or several (e.g. tags): the row matches if any equals
   *  the picked option. */
  value: (row: T) => string | string[] | null | undefined;
};

type Props<T> = {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** Status tabs. Counts cover every row, not the searched view, so they
   *  always describe the whole list. */
  tabs?: Tab<T>[];
  /** Dropdown filters; options are the distinct values found in the rows. */
  filters?: Filter<T>[];
  search?: {
    placeholder: string;
    text: (row: T) => string;
    /** Matched on digits only, so "012-345" finds "0123456789". */
    digits?: (row: T) => string;
  };
  emptyText: string;
  defaultPageSize?: number;
  /** Extra controls at the right of the toolbar, e.g. an "Add" button. */
  toolbarEnd?: ReactNode;
};

const PAGE_SIZES = [10, 20, 50, 0]; // 0 = all

/** The admin's list pattern: tabs with counts, page size, dropdown filters,
 *  search, a table and paging. Filtering is client-side over the loaded
 *  rows — one operator's data runs to hundreds of rows, not millions. */
export default function DataTable<T>({
  rows,
  rowKey,
  columns,
  tabs,
  filters = [],
  search,
  emptyText,
  defaultPageSize = 20,
  toolbarEnd,
}: Props<T>) {
  const [tab, setTab] = useState(tabs?.[0]?.key ?? "");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);

  const counts = useMemo(
    () => Object.fromEntries((tabs ?? []).map((t) => [t.key, rows.filter(t.test).length])),
    [rows, tabs]
  );

  const options = useMemo(
    () =>
      Object.fromEntries(
        filters.map((f) => [
          f.key,
          Array.from(
            new Set(rows.flatMap((r) => [f.value(r)].flat()).filter((v): v is string => !!v))
          ).sort(),
        ])
      ),
    [rows, filters]
  );

  const filtered = useMemo(() => {
    const activeTab = tabs?.find((t) => t.key === tab);
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return rows.filter((r) => {
      if (activeTab && !activeTab.test(r)) return false;
      for (const f of filters) {
        const want = picked[f.key];
        if (want && ![f.value(r)].flat().includes(want)) return false;
      }
      if (!q || !search) return true;
      if (search.text(r).toLowerCase().includes(q)) return true;
      return (
        !!search.digits &&
        qDigits.length >= 3 &&
        search.digits(r).replace(/[^0-9]/g, "").includes(qDigits)
      );
    });
  }, [rows, tabs, tab, filters, picked, query, search]);

  const pages = size === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages - 1);
  const start = size === 0 ? 0 : current * size;
  const shown = size === 0 ? filtered : filtered.slice(start, start + size);

  const toFirstPage = () => setPage(0);

  return (
    <div>
      {tabs && tabs.length > 0 && (
        <div className={styles.dtTabs} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${styles.dtTab} ${tab === t.key ? styles.dtTabOn : ""}`}
              onClick={() => {
                setTab(t.key);
                toFirstPage();
              }}
            >
              {t.label} ({counts[t.key] ?? 0})
            </button>
          ))}
        </div>
      )}

      <div className={styles.dtCard}>
        <div className={styles.dtBar}>
          <label>
            Show{" "}
            <select
              className={styles.dtSelect}
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                toFirstPage();
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "All" : n}
                </option>
              ))}
            </select>
          </label>
          {filters.map((f) => (
            <select
              key={f.key}
              className={styles.dtSelect}
              value={picked[f.key] ?? ""}
              aria-label={f.allLabel}
              onChange={(e) => {
                setPicked((p) => ({ ...p, [f.key]: e.target.value }));
                toFirstPage();
              }}
            >
              <option value="">{f.allLabel}</option>
              {options[f.key].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
          {search && (
            <input
              className={styles.dtSearch}
              type="search"
              placeholder={search.placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                toFirstPage();
              }}
            />
          )}
          {toolbarEnd}
        </div>

        <div className={styles.dtScroll}>
          <table className={styles.dtTable}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.align === "right" ? styles.dtNum : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={rowKey(r)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.align === "right" ? styles.dtNum : undefined}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <div className={styles.dtEmpty}>{emptyText}</div>}
        </div>

        <div className={styles.dtFoot}>
          <span>
            Showing {filtered.length === 0 ? 0 : start + 1}–{start + shown.length} of{" "}
            {filtered.length}
          </span>
          {pages > 1 && (
            <div className={styles.dtPager}>
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>
                ‹
              </button>
              {Array.from({ length: pages }, (_, i) => i)
                .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - current) <= 1)
                .map((i) => (
                  <button
                    key={i}
                    type="button"
                    className={i === current ? styles.dtPageOn : ""}
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              <button
                type="button"
                disabled={current === pages - 1}
                onClick={() => setPage(current + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
