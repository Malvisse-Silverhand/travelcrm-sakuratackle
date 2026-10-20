"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/public/book/Icon";
import {
  FIELDS_FOR,
  FIELD_LABEL,
  cleanRow,
  guessField,
  parseCsv,
  type CleanRow,
  type Field,
  type ImportKind,
} from "@/lib/import/sheet";
import styles from "./import.module.css";

export type BatchRow = {
  id: string;
  kind: ImportKind;
  file_label: string;
  rows_total: number;
  rows_added: number;
  rows_merged: number;
  rows_skipped: number;
  trips_added: number;
  undone_at: string | null;
  created_at: string;
};

type Counts = Record<string, number>;

const STEPS = ["Sheet", "Columns", "Check"];

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** Bring in old customers (with past trips) or leads from a Google Sheet:
 *  1 paste the link or upload a CSV, 2 match the columns, 3 check and import. */
export default function ImportWizard({ initialKind, batches }: { initialKind: ImportKind; batches: BatchRow[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [step, setStep] = useState(0);
  const [link, setLink] = useState("");
  const [label, setLabel] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Array<Field | "">>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Counts | null>(null);

  const header = table[0] ?? [];
  const body = table.slice(1);
  const cleaned = useMemo(
    () => (step >= 1 ? body.map((r) => cleanRow(r, mapping)).filter((r): r is CleanRow => !!r) : []),
    [body, mapping, step]
  );

  const load = (csv: string, name: string) => {
    const rows = parseCsv(csv);
    if (rows.length < 2) return setError("The sheet is empty, or only has a header row.");
    setTable(rows);
    setMapping(rows[0].map((h) => guessField(h, kind)));
    setLabel(name);
    setStep(1);
    setError(null);
  };

  const fetchSheet = async () => {
    setBusy(true);
    setError(null);
    const { ok, json } = await post("/api/admin/import/fetch", { url: link });
    setBusy(false);
    if (!ok) return setError(json.error ?? "Could not read that sheet.");
    load(json.csv, "Google Sheet");
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => load(String(reader.result ?? ""), file.name);
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  const check = async () => {
    if (!mapping.includes("phone")) return setError("Pick the column that holds the phone number.");
    setBusy(true);
    setError(null);
    const { ok, json } = await post("/api/admin/import/commit", { kind, fileLabel: label, rows: cleaned, dryRun: true });
    setBusy(false);
    if (!ok) return setError(json.error ?? "Could not check the rows.");
    setCounts(json.counts);
    setStep(2);
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    const { ok, json } = await post("/api/admin/import/commit", { kind, fileLabel: label, rows: cleaned });
    setBusy(false);
    if (!ok) return setError(json.error ?? "The import did not finish.");
    setDone(json.counts);
    router.refresh();
  };

  const undo = async (id: string) => {
    if (!window.confirm("Undo this import? Everything it added is removed.")) return;
    const { ok, json } = await post(`/api/admin/import/${id}/undo`, {});
    if (!ok) return setError(json.error ?? "Undo did not work.");
    router.refresh();
  };

  const reset = () => {
    setStep(0);
    setTable([]);
    setCounts(null);
    setDone(null);
    setLink("");
    setError(null);
  };

  const fields = FIELDS_FOR[kind];
  const tripsMapped = mapping.includes("trip_date");

  return (
    <div className={styles.wrap}>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? styles.stepNow : i < step ? styles.stepDone : ""}>
            <span>{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      <div className={styles.card}>
        {done ? (
          <div className={styles.done}>
            <Icon name="checkCircle" size={44} className={styles.doneIcon} />
            <h2>Imported</h2>
            <p>
              {kind === "customers"
                ? `${done.customers} customers (${done.added} new, ${done.merged} already known) and ${done.trips} past trips.`
                : `${done.leads} new leads on the board.`}{" "}
              {done.skipped > 0 && `${done.skipped} rows had no phone number and were skipped.`}
            </p>
            <div className={styles.row}>
              <a href={kind === "customers" ? "/admin/customers" : "/admin/leads"} className={styles.primary}>
                {kind === "customers" ? "See customers" : "See leads"}
              </a>
              <button type="button" className={styles.ghost} onClick={reset}>
                Import another
              </button>
            </div>
          </div>
        ) : step === 0 ? (
          <>
            <div className={styles.kindRow} role="radiogroup" aria-label="Import into">
              {(["customers", "leads"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={`${styles.kind} ${kind === k ? styles.kindOn : ""}`}
                  onClick={() => setKind(k)}
                >
                  <Icon name={k === "customers" ? "users" : "sparkle"} size={22} />
                  <span>
                    <b>{k === "customers" ? "Old customers" : "Leads"}</b>
                    <small>
                      {k === "customers"
                        ? "People who sailed before the system, with their trip dates and amounts"
                        : "People who asked but have not booked yet"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <label className={styles.field} htmlFor="imp-link">
              Google Sheet link
              <input
                id="imp-link"
                value={link}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
            <p className={styles.hint}>
              In Google Sheets: Share → General access → &quot;Anyone with the link&quot; (Viewer). Open the tab you want before
              copying the link. The first row must be the column names.
            </p>
            <div className={styles.row}>
              <button type="button" className={styles.primary} disabled={busy || !link.trim()} onClick={fetchSheet}>
                {busy ? "Reading…" : "Read the sheet"}
              </button>
              <label className={styles.ghost} htmlFor="imp-file">
                Or upload a .csv
                <input
                  id="imp-file"
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <p className={styles.lead}>
              {body.length} rows found. Check what each column is. Columns set to &quot;Skip&quot; are left out.
            </p>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {header.map((h, i) => (
                      <th key={i}>
                        <span className={styles.colName}>{h || `Column ${i + 1}`}</span>
                        <select
                          id={`imp-col-${i}`}
                          value={mapping[i] ?? ""}
                          className={mapping[i] ? styles.mapped : ""}
                          onChange={(e) => {
                            const next = [...mapping];
                            const v = e.target.value as Field | "";
                            // A field maps to one column only.
                            for (let j = 0; j < next.length; j++) if (v && next[j] === v) next[j] = "";
                            next[i] = v;
                            setMapping(next);
                          }}
                        >
                          <option value="">Skip</option>
                          {fields.map((f) => (
                            <option key={f} value={f}>
                              {FIELD_LABEL[f]}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.slice(0, 10).map((r, ri) => (
                    <tr key={ri}>
                      {header.map((_, i) => (
                        <td key={i}>{r[i]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.hint}>
              {cleaned.length} of {body.length} rows have a usable phone number.
              {kind === "customers" && !tripsMapped && " Map a trip date column to bring in past trips too."}
              {" "}Dates are read day first (14/3/2025), as in Malaysia.
            </p>
            <div className={styles.row}>
              <button type="button" className={styles.ghost} onClick={reset}>
                Back
              </button>
              <button type="button" className={styles.primary} disabled={busy} onClick={check}>
                {busy ? "Checking…" : "Check"}
              </button>
            </div>
          </>
        ) : (
          counts && (
            <>
              <ul className={styles.summary}>
                {kind === "customers" ? (
                  <>
                    <li>
                      <Icon name="users" size={22} /> <b>{counts.customers}</b> customers: {counts.added} new,{" "}
                      {counts.merged} already in the system (their history is added to them)
                    </li>
                    <li>
                      <Icon name="fish" size={22} /> <b>{counts.trips}</b> past trips
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Icon name="sparkle" size={22} /> <b>{counts.leads}</b> new leads
                      {counts.existingCustomers > 0 && `, ${counts.existingCustomers} of them already customers`}
                    </li>
                    {counts.alreadyOpen > 0 && (
                      <li>
                        <Icon name="chat" size={22} /> {counts.alreadyOpen} already have an open lead (left as they are)
                      </li>
                    )}
                  </>
                )}
                {counts.skipped > 0 && (
                  <li>
                    <Icon name="undo" size={22} /> {counts.skipped} rows skipped (no phone number)
                  </li>
                )}
              </ul>
              <div className={styles.row}>
                <button type="button" className={styles.ghost} disabled={busy} onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className={styles.primary} disabled={busy} onClick={commit}>
                  {busy ? "Importing…" : "Import"}
                </button>
              </div>
            </>
          )
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {batches.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.h2}>Past imports</h2>
          <ul className={styles.batches}>
            {batches.map((b) => (
              <li key={b.id}>
                <span>
                  <b>{b.file_label}</b> · {b.kind === "customers" ? `${b.rows_added + b.rows_merged} customers, ${b.trips_added} trips` : `${b.rows_added} leads`} ·{" "}
                  {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {b.undone_at ? (
                  <small>Undone</small>
                ) : (
                  <button type="button" className={styles.ghost} onClick={() => undo(b.id)}>
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
