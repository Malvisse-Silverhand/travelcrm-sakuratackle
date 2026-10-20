"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/public/book/Icon";
import Kanban, { type KanbanColumn } from "@/components/admin/board/Kanban";
import DataTable, { type Column } from "@/components/admin/DataTable";
import { waToCustomer } from "@/lib/admin/waTemplates";
import { formatRM } from "@/lib/date";
import { formatLongDate } from "@/lib/season";
import { LEAD_SOURCES, LOST_REASONS, STAGES, followUpDue, isOpen, leadMessage, leadStats, type Lead, type LeadStage } from "@/lib/leads";
import board from "@/components/admin/board/board.module.css";
import ax from "@/components/admin/bookingActions/bookingActions.module.css";
import adminStyles from "../../../app/admin/admin.module.css";

type Boat = { id: string; code: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/** Leads: New → Contacted → Quoted → Won / Lost, as a board or a list. */
export default function LeadsBoard({
  leads,
  boats,
  today,
  monthStart,
  view,
}: {
  leads: Lead[];
  boats: Boat[];
  today: string;
  monthStart: string;
  view: "board" | "list";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [lostFor, setLostFor] = useState<Lead | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return leads.filter(
      (l) =>
        (!source || l.source === source) &&
        (!q || l.name.toLowerCase().includes(q) || (qd.length >= 3 && l.phone.includes(qd)))
    );
  }, [leads, query, source]);

  const stats = leadStats(leads, monthStart);
  const boatCode = (id: string | null) => boats.find((b) => b.id === id)?.code;

  const move = async (l: Lead, stage: LeadStage) => {
    if (stage === "won") return book(l);
    if (stage === "lost") return setLostFor(l);
    setToast(null);
    const { ok, json } = await post(`/api/admin/leads/${l.id}`, { stage });
    if (!ok) return setToast({ ok: false, text: json.error ?? "Not saved." });
    setToast({ ok: true, text: `${l.name}: ${STAGES.find((s) => s.key === stage)?.label}.` });
    router.refresh();
  };

  const book = (l: Lead) => {
    const q = new URLSearchParams({ lead: l.id, name: l.name, phone: l.phone });
    if (l.email) q.set("email", l.email);
    if (l.pax) q.set("pax", String(l.pax));
    if (l.wanted_date && l.wanted_date >= today) q.set("date", l.wanted_date);
    if (l.boat_id) q.set("boat", l.boat_id);
    router.push(`/admin/bookings/new?${q.toString()}`);
  };

  const setFollowUp = async (l: Lead, date: string) => {
    const { ok } = await post(`/api/admin/leads/${l.id}`, { followUp: date || null });
    if (ok) router.refresh();
  };

  const columns: KanbanColumn<Lead>[] = STAGES.map((s) => {
    const items = shown
      .filter((l) => l.stage === s.key)
      .sort((a, b) =>
        isOpen(a)
          ? (a.next_follow_up ?? "9999").localeCompare(b.next_follow_up ?? "9999")
          : b.stage_changed_at.localeCompare(a.stage_changed_at)
      );
    const sub =
      s.key === "won"
        ? formatRM(items.reduce((t, l) => t + Number(l.won_amount ?? 0), 0))
        : s.key === "lost"
          ? items.length
            ? `Top: ${stats.topLost[0]?.[0] ?? "—"}`
            : undefined
          : `${items.filter((l) => followUpDue(l, today)).length} to follow up`;
    return {
      key: s.key,
      label: s.label,
      icon: s.icon,
      tone: s.tone,
      items: s.key === "won" || s.key === "lost" ? items.slice(0, 30) : items,
      sub,
      accepts: (l: Lead) => l.stage !== s.key && (isOpen(l) || s.key !== "won"),
      onDrop: (l: Lead) => move(l, s.key),
      empty: s.key === "won" ? "Wins land here" : "Nothing here",
    };
  });

  const card = (l: Lead) => {
    const src = LEAD_SOURCES[l.source] ?? LEAD_SOURCES.manual;
    const due = followUpDue(l, today);
    return (
      <article className={board.card}>
        <div className={board.cardTop}>
          <span>
            <b className={board.cardName} data-pii="name">
              {l.name}
            </b>
            <span className={board.cardRef}> · {l.phone}</span>
          </span>
          {due && (
            <span className={`${board.countdown} ${board.countdownSoon}`} style={{ background: "#ffd1c2", color: "#a3300c" }} title="Follow-up due">
              <Icon name="flame" size={12} /> {l.next_follow_up! < today ? "Overdue" : "Today"}
            </span>
          )}
        </div>
        <span className={board.meta}>
          {l.wanted_date ? formatLongDate(l.wanted_date) : "No date yet"}
          {l.pax ? ` · ${l.pax} pax` : ""}
          {boatCode(l.boat_id) ? ` · ${boatCode(l.boat_id)}` : ""}
        </span>
        {l.notes && <span className={board.meta} style={{ whiteSpace: "pre-wrap" }}>{l.notes.slice(0, 140)}</span>}
        <div className={board.events}>
          <span className={board.event} title={src.label} aria-label={src.label}>
            <Icon name={src.icon} size={15} />
          </span>
          {l.stage === "lost" && l.lost_reason && <span className={`${board.chip} ${board.chip_due}`}>{l.lost_reason}</span>}
          {l.stage === "won" && l.booking_id && (
            <Link href={`/admin/bookings/${l.booking_id}`} className={`${board.chip} ${board.chip_ok}`}>
              Booking {l.won_amount ? formatRM(Number(l.won_amount)) : ""}
            </Link>
          )}
        </div>
        {isOpen(l) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <a href={waToCustomer(l.phone, leadMessage(l))} target="_blank" rel="noopener noreferrer" className={ax.wa}>
              WhatsApp
            </a>
            <button type="button" className={ax.primary} onClick={() => book(l)}>
              Book
            </button>
            <select
              aria-label={`Move ${l.name} to`}
              value=""
              onChange={(e) => e.target.value && move(l, e.target.value as LeadStage)}
              style={{ height: 30, borderRadius: 8, border: "1px solid var(--border-mid)", font: "inherit", fontSize: 12 }}
            >
              <option value="">Move…</option>
              {STAGES.filter((s) => s.key !== l.stage && s.key !== "won").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 11.5, color: "var(--text-muted-2)", display: "inline-flex", gap: 4, alignItems: "center" }}>
              <Icon name="calendar" size={14} />
              <input
                type="date"
                aria-label="Follow up on"
                value={l.next_follow_up ?? ""}
                onChange={(e) => setFollowUp(l, e.target.value)}
                style={{ border: 0, font: "inherit", fontSize: 11.5, background: "transparent", color: "var(--ink)" }}
              />
            </label>
          </div>
        )}
      </article>
    );
  };

  const listColumns: Column<Lead>[] = [
    {
      key: "name",
      header: "Lead",
      render: (l) => (
        <>
          <span className={adminStyles.dtStrong}>{l.name}</span>
          <span className={adminStyles.dtSub}>{l.phone}</span>
        </>
      ),
    },
    { key: "source", header: "Source", render: (l) => LEAD_SOURCES[l.source]?.label ?? l.source },
    { key: "date", header: "Wants", render: (l) => (l.wanted_date ? formatLongDate(l.wanted_date) : "—") },
    { key: "pax", header: "Pax", align: "right", render: (l) => l.pax ?? "—" },
    { key: "stage", header: "Stage", render: (l) => STAGES.find((s) => s.key === l.stage)?.label },
    {
      key: "follow",
      header: "Follow up",
      render: (l) => (l.next_follow_up ? `${formatLongDate(l.next_follow_up)}${followUpDue(l, today) ? " · due" : ""}` : "—"),
    },
    {
      key: "act",
      header: "Actions",
      align: "right",
      render: (l) =>
        isOpen(l) ? (
          <div className={adminStyles.dtActions}>
            <a href={waToCustomer(l.phone, leadMessage(l))} target="_blank" rel="noopener noreferrer" className={`${adminStyles.dtBtn} ${adminStyles.dtBtnWa}`}>
              WhatsApp
            </a>
            <button type="button" className={`${adminStyles.dtBtn} ${adminStyles.dtBtnEdit}`} onClick={() => book(l)}>
              Book
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <div className={board.strip}>
        <div className={board.stat}>
          <Icon name="sparkle" size={24} />
          <span>
            <b>{stats.thisMonth}</b>
            <span>
              leads this month
              {stats.bySource[0] ? `, most from ${LEAD_SOURCES[stats.bySource[0][0]]?.label ?? stats.bySource[0][0]}` : ""}
            </span>
          </span>
        </div>
        <div className={board.stat}>
          <Icon name="star" size={24} />
          <span>
            <b>{stats.winRate}%</b>
            <span>win rate (closed leads)</span>
          </span>
        </div>
        <div className={board.stat}>
          <Icon name="clock" size={24} />
          <span>
            <b>{stats.avgDaysToWin} days</b>
            <span>average to win</span>
          </span>
        </div>
        <div className={board.stat}>
          <Icon name="coins" size={24} />
          <span>
            <b>{formatRM(stats.wonAmount)}</b>
            <span>booked from leads</span>
          </span>
        </div>
      </div>

      <div className={board.toolbar}>
        <button type="button" className={ax.primary} style={{ minHeight: 38, fontSize: 13 }} onClick={() => setAdding(true)}>
          + Add lead
        </button>
        <Link href="/admin/customers/import?into=leads" className={ax.more} style={{ minHeight: 38, padding: "0 14px", fontSize: 13 }}>
          Import from Google Sheets
        </Link>
        <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {Object.entries(LEAD_SOURCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {toast && <p className={`${board.toast} ${toast.ok ? board.toastOk : board.toastErr}`}>{toast.text}</p>}

      {view === "board" ? (
        <Kanban columns={columns} itemKey={(l) => l.id} renderCard={(l) => card(l)} />
      ) : (
        <DataTable
          rows={shown}
          rowKey={(l) => l.id}
          columns={listColumns}
          tabs={[
            { key: "open", label: "Open", test: isOpen },
            { key: "due", label: "Follow up due", test: (l) => followUpDue(l, today) },
            ...STAGES.map((s) => ({ key: s.key, label: s.label, test: (l: Lead) => l.stage === s.key })),
          ]}
          emptyText="No leads here."
        />
      )}

      {lostFor && (
        <LostDialog
          lead={lostFor}
          onClose={() => setLostFor(null)}
          onDone={() => {
            setLostFor(null);
            router.refresh();
          }}
        />
      )}
      {adding && (
        <AddLeadDialog
          today={today}
          onClose={() => setAdding(false)}
          onDone={(name) => {
            setAdding(false);
            setToast({ ok: true, text: `${name} added to New.` });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LostDialog({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!reason) return setError("Pick a reason.");
    setBusy(true);
    const { ok, json } = await post(`/api/admin/leads/${lead.id}`, { stage: "lost", lostReason: reason });
    setBusy(false);
    if (!ok) return setError(json.error ?? "Not saved.");
    onDone();
  };
  return (
    <div className={ax.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={ax.dialog} role="dialog" aria-modal="true" aria-labelledby="lost-title">
        <h2 id="lost-title">Why was {lead.name.split(" ")[0]} lost?</h2>
        <div className={ax.chips}>
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" className={`${ax.chip} ${reason === r ? ax.chipOn : ""}`} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <p>The reasons add up on the Reports page, so you can see why people do not book.</p>
        {error && <p className={ax.err}>{error}</p>}
        <div className={ax.actions}>
          <button type="button" className={`${ax.btn} ${ax.btnGhost}`} onClick={onClose}>
            Keep open
          </button>
          <button type="button" className={`${ax.btn} ${ax.btnDanger}`} disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Mark lost"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLeadDialog({
  today,
  onClose,
  onDone,
}: {
  today: string;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [f, setF] = useState({ name: "", phone: "", source: "whatsapp", wantedDate: "", pax: "", notes: "", followUp: today });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    setError(null);
    const { ok, json } = await post("/api/admin/leads", { ...f, pax: Number(f.pax) || null });
    setBusy(false);
    if (!ok) return setError(json.error ?? "Not saved.");
    onDone(f.name);
  };
  return (
    <div className={ax.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        className={ax.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 id="add-lead-title">New lead</h2>
        <div className={ax.pair}>
          <label className={ax.field} htmlFor="ld-name">
            Name
            <input id="ld-name" value={f.name} maxLength={120} onChange={set("name")} autoFocus />
          </label>
          <label className={ax.field} htmlFor="ld-phone">
            Phone
            <input id="ld-phone" type="tel" inputMode="tel" value={f.phone} maxLength={20} onChange={set("phone")} placeholder="0123456789" />
          </label>
        </div>
        <div className={ax.field}>
          Came from
          <div className={ax.chips}>
            {(["whatsapp", "phone", "facebook", "instagram", "walk_in", "manual"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`${ax.chip} ${f.source === k ? ax.chipOn : ""}`}
                onClick={() => setF((x) => ({ ...x, source: k }))}
              >
                {LEAD_SOURCES[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className={ax.pair}>
          <label className={ax.field} htmlFor="ld-date">
            Wants to go on
            <input id="ld-date" type="date" min={today} value={f.wantedDate} onChange={set("wantedDate")} />
          </label>
          <label className={ax.field} htmlFor="ld-pax">
            Group size
            <input id="ld-pax" type="number" min={1} max={100} inputMode="numeric" value={f.pax} onChange={set("pax")} />
          </label>
        </div>
        <label className={ax.field} htmlFor="ld-notes">
          Note
          <textarea id="ld-notes" rows={2} maxLength={2000} value={f.notes} onChange={set("notes")} placeholder="e.g. company trip, asked about price for 2 boats" />
        </label>
        <label className={ax.field} htmlFor="ld-follow">
          Follow up on
          <input id="ld-follow" type="date" value={f.followUp} onChange={set("followUp")} />
        </label>
        {error && <p className={ax.err}>{error}</p>}
        <div className={ax.actions}>
          <button type="button" className={`${ax.btn} ${ax.btnGhost}`} disabled={busy} onClick={onClose}>
            Close
          </button>
          <button type="submit" className={`${ax.btn} ${ax.btnPrimary}`} disabled={busy}>
            {busy ? "Adding…" : "Add lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
