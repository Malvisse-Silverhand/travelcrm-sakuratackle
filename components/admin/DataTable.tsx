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
  /** Adds "Export CSV": the rows currently shown by the tab, filters and
   *  search (all pages), with these columns. */
  csv?: CsvSpec<T>;
  /** Adds a tick box per row; when rows are ticked, `bulkBar` renders above
   *  the table with them. */
  selectable?: boolean;
  bulkBar?: (selected: T[], clear: () => void) => ReactNode;
};

export type CsvSpec<T> = {
  /** File name without extension, e.g. "bookings". Today's date is added. */
  filename: string;
  columns: Array<{ header: string; value: (row: T) => string | number | boolean | null | undefined }>;
};

/** RFC 4180 quoting; a leading = + - @ is prefixed so a spreadsheet does
 *  not run a customer-typed value as a formula. */
function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv<T>(spec: CsvSpec<T>, rows: T[]) {
  const lines = [
    spec.columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((r) => spec.columns.map((c) => csvCell(c.value(r))).join(",")),
  ];
  // BOM so Excel opens UTF-8 (names, "—") correctly.
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${spec.filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

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
  csv,
  selectable = false,
  bulkBar,
}: Props<T>) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
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

  // Ticked rows that are still loaded (a refresh can drop some).
  const selected = selectable ? rows.filter((r) => ticked.has(rowKey(r))) : [];
  const clear = () => setTicked(new Set());
  const allShownTicked = shown.length > 0 && shown.every((r) => ticked.has(rowKey(r)));
  const toggle = (key: string) =>
    setTicked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleShown = () =>
    setTicked((cur) => {
      const next = new Set(cur);
      for (const r of shown) {
        if (allShownTicked) next.delete(rowKey(r));
        else next.add(rowKey(r));
      }
      return next;
    });

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
          {csv && (
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
              onClick={() => downloadCsv(csv, filtered)}
              disabled={filtered.length === 0}
              title="Download the rows shown (all pages) as a spreadsheet"
            >
              Export CSV
            </button>
          )}
          {toolbarEnd}
        </div>

        {selected.length > 0 && bulkBar && <div className={styles.dtBulk}>{bulkBar(selected, clear)}</div>}

        <div className={styles.dtScroll}>
          <table className={styles.dtTable}>
            <thead>
              <tr>
                {selectable && (
                  <th className={styles.dtTick}>
                    <input type="checkbox" aria-label="Tick all rows shown" checked={allShownTicked} onChange={toggleShown} />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} className={c.align === "right" ? styles.dtNum : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={rowKey(r)} className={selectable && ticked.has(rowKey(r)) ? styles.dtRowTicked : undefined}>
                  {selectable && (
                    <td className={styles.dtTick}>
                      <input
                        type="checkbox"
                        aria-label="Tick row"
                        checked={ticked.has(rowKey(r))}
                        onChange={() => toggle(rowKey(r))}
                      />
                    </td>
                  )}
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
