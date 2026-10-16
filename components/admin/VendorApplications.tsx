"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type Tab } from "./DataTable";
import { waNumber } from "@/lib/phone";
import styles from "../../app/admin/admin.module.css";

export type ApplicationRow = {
  id: string;
  name: string;
  business: string | null;
  email: string;
  phone: string;
  jetty: string | null;
  boatCount: number | null;
  boatDetails: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "approved" | "rejected";
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type FreeBoat = { id: string; code: string };
type InviteResult = { name: string; link: string; whatsapp: string; emailed: boolean; emailError: string | null };

const TABS: Tab<ApplicationRow>[] = [
  { key: "new", label: "New", test: (a) => a.status === "new" },
  { key: "approved", label: "Approved", test: (a) => a.status === "approved" },
  { key: "rejected", label: "Rejected", test: (a) => a.status === "rejected" },
  { key: "all", label: "All", test: () => true },
];

const STATUS: Record<ApplicationRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: styles.statusDepositDue },
  approved: { label: "Approved", cls: styles.statusConfirmed },
  rejected: { label: "Rejected", cls: styles.statusCancelled },
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

/** Admin → Vendor applications: boat owners who applied from the public
 *  vendor page. Approving sends the usual vendor invitation. */
export default function VendorApplications({ rows, freeBoats }: { rows: ApplicationRow[]; freeBoats: FreeBoat[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<ApplicationRow | null>(null);
  const [boats, setBoats] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const review = (a: ApplicationRow) => {
    setOpen(a);
    setBoats([]);
    setNote(a.note ?? "");
    setMsg(null);
    setResult(null);
  };

  const act = async (action: "approve" | "reject") => {
    if (!open) return;
    if (action === "reject" && !window.confirm(`Reject ${open.name}'s application?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/vendor-applications/${open.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, boatIds: boats, note }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Failed." });
    if (action === "approve") setResult(json as InviteResult);
    else setMsg({ ok: true, text: `${open.name}'s application was rejected.` });
    setOpen(null);
    router.refresh();
  };

  const columns: Column<ApplicationRow>[] = [
    {
      key: "name",
      header: "Applicant",
      render: (a) => (
        <>
          <span className={styles.dtStrong} data-pii="name">
            {a.name}
          </span>
          <span className={styles.dtSub}>{a.business ?? a.email}</span>
        </>
      ),
    },
    { key: "phone", header: "Phone", render: (a) => a.phone },
    { key: "jetty", header: "Location", render: (a) => a.jetty ?? "—" },
    { key: "boats", header: "Boats", align: "right", render: (a) => a.boatCount ?? "—" },
    { key: "date", header: "Applied", render: (a) => when(a.createdAt) },
    {
      key: "status",
      header: "Status",
      render: (a) => <span className={`${styles.manifestStatus} ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (a) => (
        <div className={styles.dtActions}>
          <button type="button" className={`${styles.dtBtn} ${styles.dtBtnEdit}`} onClick={() => review(a)}>
            {a.status === "approved" ? "View" : "Review"}
          </button>
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

      {result && (
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>Vendor invitation for {result.name}</span>
          <p className={styles.seasonHint} style={{ margin: "8px 0" }}>
            {result.emailed ? "Emailed. " : result.emailError ? `${result.emailError} ` : ""}
            This link is shown only now. Assign their boats later in Users &amp; roles.
          </p>
          <input className={styles.input} readOnly value={result.link} onFocus={(e) => e.target.select()} />
          <div className={styles.dtActions} style={{ justifyContent: "flex-start", marginTop: 10 }}>
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
              onClick={() => navigator.clipboard?.writeText(result.link)}
            >
              Copy link
            </button>
            <a href={result.whatsapp} target="_blank" rel="noopener noreferrer" className={`${styles.dtBtn} ${styles.dtBtnWa}`}>
              Send by WhatsApp
            </a>
          </div>
        </div>
      )}

      {open && (
        <div className={styles.detailCard}>
          <span className={styles.detailCardLabel}>
            Application from {open.name} · {STATUS[open.status].label}
          </span>
          <dl className={styles.appDetails}>
            <dt>Business / boat name</dt>
            <dd>{open.business ?? "—"}</dd>
            <dt>Phone</dt>
            <dd>
              {open.phone}{" "}
              <a href={`https://wa.me/${waNumber(open.phone)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </dd>
            <dt>Email</dt>
            <dd>{open.email}</dd>
            <dt>Location</dt>
            <dd>{open.jetty ?? "—"}</dd>
            <dt>Boats</dt>
            <dd>{open.boatCount ?? "—"}</dd>
            <dt>Boat details</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{open.boatDetails ?? "—"}</dd>
            <dt>Message</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{open.message ?? "—"}</dd>
            <dt>Applied</dt>
            <dd>
              {when(open.createdAt)}
              {open.source ? ` from /${open.source}` : ""}
            </dd>
            {open.reviewedAt && (
              <>
                <dt>Reviewed</dt>
                <dd>{when(open.reviewedAt)}</dd>
              </>
            )}
          </dl>

          {open.status === "approved" ? (
            <p className={styles.seasonHint}>
              Approved{open.note ? `: ${open.note}` : ""}. Their invitation is under Users &amp; roles → Open invitations.
            </p>
          ) : (
            <>
              <span className={styles.fieldLabel} style={{ display: "block", marginTop: 14 }}>
                Boats to hand over now (optional)
              </span>
              {freeBoats.length === 0 ? (
                <p className={styles.filterCount}>
                  No boats without a vendor. Add their boat in Fleet first, or assign it later in Users &amp; roles.
                </p>
              ) : (
                <div className={styles.boatPicker}>
                  {freeBoats.map((b) => (
                    <label key={b.id} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={boats.includes(b.id)}
                        onChange={(e) => setBoats(e.target.checked ? [...boats, b.id] : boats.filter((x) => x !== b.id))}
                      />
                      {b.code}
                    </label>
                  ))}
                </div>
              )}
              <label className={styles.field} style={{ marginTop: 12 }}>
                <span className={styles.fieldLabel}>Note (only admins see it)</span>
                <input className={styles.input} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className={styles.dtActions} style={{ justifyContent: "flex-start", marginTop: 6 }}>
                <button type="button" className={`${styles.dtBtn} ${styles.dtBtnOk}`} disabled={busy} onClick={() => act("approve")}>
                  {busy ? "Working…" : "Approve & send invitation"}
                </button>
                {open.status === "new" && (
                  <button type="button" className={`${styles.dtBtn} ${styles.dtBtnDanger}`} disabled={busy} onClick={() => act("reject")}>
                    Reject
                  </button>
                )}
                <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => setOpen(null)}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <DataTable
        rows={rows}
        rowKey={(a) => a.id}
        columns={columns}
        tabs={TABS}
        search={{
          placeholder: "Search name, email or location",
          text: (a) => `${a.name} ${a.business ?? ""} ${a.email} ${a.jetty ?? ""}`,
          digits: (a) => a.phone,
        }}
        emptyText="No applications here yet. Share the vendor page link (/jadi-vendor) with boat owners."
        csv={{
          filename: "vendor-applications",
          columns: [
            { header: "Name", value: (a) => a.name },
            { header: "Business", value: (a) => a.business },
            { header: "Phone", value: (a) => a.phone },
            { header: "Email", value: (a) => a.email },
            { header: "Location", value: (a) => a.jetty },
            { header: "Boats", value: (a) => a.boatCount },
            { header: "Boat details", value: (a) => a.boatDetails },
            { header: "Status", value: (a) => a.status },
            { header: "Applied", value: (a) => a.createdAt.slice(0, 10) },
          ],
        }}
      />
    </>
  );
}
