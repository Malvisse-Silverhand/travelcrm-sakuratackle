"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLongDate } from "@/lib/season";
import DataTable, { type Column, type Tab } from "./DataTable";
import styles from "../../app/admin/admin.module.css";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "vendor";
  active: boolean;
  me: boolean;
  boatIds: string[];
};

export type InviteRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "vendor";
  boats: string[];
  expiresAt: string;
};

type Boat = { id: string; code: string; active: boolean; vendorId: string | null };

type LinkResult = { name: string; link: string; whatsapp: string; emailed: boolean; emailError: string | null };

const TABS: Tab<UserRow>[] = [
  { key: "active", label: "Active", test: (u) => u.active },
  { key: "admins", label: "Admins", test: (u) => u.role === "admin" },
  { key: "vendors", label: "Vendors", test: (u) => u.role === "vendor" },
  { key: "off", label: "Switched off", test: (u) => !u.active },
  { key: "all", label: "All", test: () => true },
];

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** Users & roles: the team, inviting admins and vendors, and their access. */
export default function UsersPanel({
  users,
  invites,
  boats,
  emailReady,
}: {
  users: UserRow[];
  invites: InviteRow[];
  boats: Boat[];
  emailReady: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editBoats, setEditBoats] = useState<string[]>([]);

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", role: "admin" as "admin" | "vendor" });
  const [formBoats, setFormBoats] = useState<string[]>([]);

  const codeOf = new Map(boats.map((b) => [b.id, b.code]));

  const toggleActive = async (u: UserRow) => {
    if (!window.confirm(`${u.active ? "Switch off" : "Switch on"} access for ${u.name}?`)) return;
    setBusy(u.id);
    setMsg(null);
    const { ok, json } = await post(`/api/admin/users/${u.id}`, { active: !u.active });
    setBusy(null);
    setMsg(ok ? { ok: true, text: `${u.name}: access ${u.active ? "switched off" : "switched on"}.` } : { ok: false, text: json.error ?? "Failed." });
    if (ok) router.refresh();
  };

  const saveBoats = async () => {
    if (!editing) return;
    setBusy(editing.id);
    const { ok, json } = await post(`/api/admin/users/${editing.id}`, { boatIds: editBoats });
    setBusy(null);
    setMsg(ok ? { ok: true, text: `${editing.name}'s boats saved.` } : { ok: false, text: json.error ?? "Failed." });
    if (ok) {
      setEditing(null);
      router.refresh();
    }
  };

  const invite = async () => {
    setMsg(null);
    setResult(null);
    setBusy("invite");
    const { ok, json } = await post("/api/admin/invites", { ...form, boatIds: formBoats });
    setBusy(null);
    if (!ok) return setMsg({ ok: false, text: json.error ?? "Could not invite." });
    setResult({ name: form.fullName, link: json.link, whatsapp: json.whatsapp, emailed: json.emailed, emailError: json.emailError });
    setForm({ fullName: "", email: "", phone: "", role: "admin" });
    setFormBoats([]);
    router.refresh();
  };

  const inviteAction = async (i: InviteRow, action: "renew" | "revoke") => {
    if (action === "revoke" && !window.confirm(`Revoke the invitation for ${i.name}? The link stops working.`)) return;
    setBusy(i.id);
    setMsg(null);
    const { ok, json } = await post(`/api/admin/invites/${i.id}`, { action });
    setBusy(null);
    if (!ok) return setMsg({ ok: false, text: json.error ?? "Failed." });
    if (action === "renew") {
      setResult({ name: i.name, link: json.link, whatsapp: json.whatsapp, emailed: json.emailed, emailError: json.emailError });
    } else {
      setMsg({ ok: true, text: `Invitation for ${i.name} revoked.` });
    }
    router.refresh();
  };

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (u) => (
        <>
          <span className={styles.dtStrong}>
            {u.name}
            {u.me ? " (you)" : ""}
          </span>
          <span className={styles.dtSub}>{u.email}</span>
        </>
      ),
    },
    { key: "phone", header: "Phone", render: (u) => u.phone ?? "—" },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <span className={`${styles.manifestStatus} ${u.role === "admin" ? styles.statusConfirmed : styles.statusDepositDue}`}>
          {u.role === "admin" ? "Admin" : "Vendor"}
        </span>
      ),
    },
    {
      key: "boats",
      header: "Boats",
      render: (u) => (u.role === "vendor" ? u.boatIds.map((id) => codeOf.get(id)).join(", ") || "None" : "All"),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span className={`${styles.manifestStatus} ${u.active ? styles.statusConfirmed : styles.statusCancelled}`}>
          {u.active ? "Active" : "Switched off"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div className={styles.dtActions}>
          {u.role === "vendor" && (
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnEdit}`}
              onClick={() => {
                setEditing(u);
                setEditBoats(u.boatIds);
              }}
            >
              Boats
            </button>
          )}
          {!u.me && (
            <button
              type="button"
              className={`${styles.dtBtn} ${u.active ? styles.dtBtnDanger : styles.dtBtnOk}`}
              disabled={busy !== null}
              onClick={() => toggleActive(u)}
            >
              {busy === u.id ? "…" : u.active ? "Switch off" : "Switch on"}
            </button>
          )}
        </div>
      ),
    },
  ];

  // A boat can belong to one vendor; the picker offers unowned boats plus
  // the ones this vendor already has.
  const pickable = (ownerId: string | null) => boats.filter((b) => b.active && (!b.vendorId || b.vendorId === ownerId));

  return (
    <div className={styles.usersGrid}>
      <div>
        {msg && (
          <p className={msg.ok ? styles.formOk : styles.formErr} style={{ margin: "0 0 12px" }}>
            {msg.text}
          </p>
        )}
        <DataTable rows={users} rowKey={(u) => u.id} columns={columns} tabs={TABS} emptyText="Nobody here." defaultPageSize={50} />

        {editing && (
          <div className={styles.detailCard} style={{ marginTop: 14 }}>
            <span className={styles.detailCardLabel}>Boats managed by {editing.name}</span>
            <BoatPicker boats={pickable(editing.id)} value={editBoats} onChange={setEditBoats} />
            <div className={styles.builderSaveRow} style={{ marginTop: 12 }}>
              <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.markPaidBtn}
                style={{ width: "auto", margin: "0 0 0 auto" }}
                disabled={busy !== null}
                onClick={saveBoats}
              >
                Save boats
              </button>
            </div>
          </div>
        )}

        <span className={styles.manifestKicker} style={{ marginTop: 22, display: "block" }}>
          Invitations waiting
        </span>
        {invites.length === 0 ? (
          <p className={styles.filterCount}>None. Invitations appear here until they are accepted.</p>
        ) : (
          <div className={styles.dtCard}>
            <div className={styles.dtScroll}>
              <table className={styles.dtTable}>
                <thead>
                  <tr>
                    <th>Invited</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th className={styles.dtNum}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span className={styles.dtStrong}>{i.name}</span>
                        <span className={styles.dtSub}>
                          {i.email}
                          {i.phone ? ` · ${i.phone}` : ""}
                        </span>
                      </td>
                      <td>
                        {i.role === "admin" ? "Admin" : `Vendor (${i.boats.join(", ")})`}
                      </td>
                      <td>{formatLongDate(i.expiresAt.slice(0, 10))}</td>
                      <td>
                        <div className={styles.dtActions}>
                          <button
                            type="button"
                            className={`${styles.dtBtn} ${styles.dtBtnEdit}`}
                            disabled={busy !== null}
                            onClick={() => inviteAction(i, "renew")}
                          >
                            New link
                          </button>
                          <button
                            type="button"
                            className={`${styles.dtBtn} ${styles.dtBtnDanger}`}
                            disabled={busy !== null}
                            onClick={() => inviteAction(i, "revoke")}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className={styles.detailCard} style={{ margin: 0 }}>
          <span className={styles.detailCardLabel}>Invite someone</span>
          <div className={styles.builderFields} style={{ marginTop: 12 }}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              <input className={styles.input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email (their sign-in)</span>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Phone (for the WhatsApp invite)</span>
              <input
                className={styles.input}
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Role</span>
              <select
                className={styles.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "vendor" })}
              >
                <option value="admin">Admin: everything</option>
                <option value="vendor">Vendor: their boats&apos; bookings and calendar</option>
              </select>
            </label>
            {form.role === "vendor" && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Their boats</span>
                <BoatPicker boats={pickable(null)} value={formBoats} onChange={setFormBoats} />
              </div>
            )}
            <button type="button" className={styles.markPaidBtn} style={{ margin: 0 }} disabled={busy !== null} onClick={invite}>
              {busy === "invite" ? "Inviting…" : "Send invitation"}
            </button>
            <p className={styles.seasonHint}>
              {emailReady
                ? "They get an email with the link. You can also send it by WhatsApp."
                : "Email is not set up yet (Resend): send the link by WhatsApp or copy it."}{" "}
              Links work for 7 days.
            </p>
          </div>
        </div>

        {result && (
          <div className={styles.detailCard} style={{ marginTop: 14 }}>
            <span className={styles.detailCardLabel}>Invitation link for {result.name}</span>
            <p className={styles.seasonHint} style={{ margin: "8px 0" }}>
              {result.emailed ? "Emailed. " : result.emailError ? `${result.emailError} ` : ""}
              This link is shown only now.
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
      </div>
    </div>
  );
}

function BoatPicker({
  boats,
  value,
  onChange,
}: {
  boats: Boat[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  if (boats.length === 0) return <p className={styles.filterCount}>No free boats: each boat belongs to one vendor.</p>;
  return (
    <div className={styles.boatPicker}>
      {boats.map((b) => (
        <label key={b.id} className={styles.checkRow}>
          <input
            type="checkbox"
            checked={value.includes(b.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((x) => x !== b.id))}
          />
          {b.code}
        </label>
      ))}
    </div>
  );
}
