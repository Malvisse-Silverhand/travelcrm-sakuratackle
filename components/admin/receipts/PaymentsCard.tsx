"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRM } from "@/lib/date";
import Icon from "@/components/public/book/Icon";
import ax from "@/components/admin/bookingActions/bookingActions.module.css";
import styles from "./receipts.module.css";

export type PaymentRow = {
  id: string;
  kind: string;
  amount: number;
  method: string;
  paid_at: string;
  proof_path: string | null;
  note: string | null;
  receipt_no: string | null;
  receipt_token: string;
  voided_at: string | null;
  void_reason: string | null;
  emailed_at: string | null;
  whatsapped_at: string | null;
};

export const KIND: Record<string, string> = { deposit: "Deposit", full: "Full payment", balance: "Balance", refund: "Refund", other: "Payment" };
export const METHOD: Record<string, string> = {
  bank_transfer: "Bank transfer",
  duitnow: "DuitNow",
  cash: "Cash",
  card: "Card",
  online: "Online",
  other: "Other",
};

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export async function paymentAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/payments/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export async function openProof(path: string) {
  const { data } = await createClient().storage.from("receipts").createSignedUrl(path, 120);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noreferrer");
}

/** Payments & receipts on the booking page: the ledger for this booking,
 *  sending receipts, recording a payment by hand, and voiding. */
export default function PaymentsCard({ bookingId, payments, hasEmail }: { bookingId: string; payments: PaymentRow[]; hasEmail: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);

  const send = async (p: PaymentRow, channel: "email" | "whatsapp") => {
    setBusy(p.id + channel);
    setMsg(null);
    // Open the window first: browsers only allow it straight from the click.
    const win = channel === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const { ok, json } = await paymentAction(p.id, { action: channel });
    setBusy(null);
    if (!ok) {
      win?.close();
      return setMsg({ ok: false, text: json.error ?? "Not sent." });
    }
    if (win && json.link) win.location.href = json.link;
    setMsg({ ok: true, text: channel === "email" ? json.message : `WhatsApp opened for ${p.receipt_no}.` });
    router.refresh();
  };

  const total = payments.filter((p) => !p.voided_at).reduce((s, p) => s + (p.kind === "refund" ? -p.amount : Number(p.amount)), 0);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.label}>Payments & receipts</span>
        <span className={styles.net}>{formatRM(total)} received</span>
      </div>
      {payments.length === 0 ? (
        <p className={styles.empty}>No payments yet. Receipts appear here when the deposit or balance is marked paid.</p>
      ) : (
        <ul className={styles.list}>
          {payments.map((p) => (
            <li key={p.id} className={p.voided_at ? styles.voided : ""}>
              <div className={styles.row}>
                <span className={styles.icon}>
                  <Icon name={p.kind === "refund" ? "undo" : p.method === "cash" ? "coins" : "card"} size={16} />
                </span>
                <span className={styles.main}>
                  <b>
                    {p.receipt_no} · {KIND[p.kind] ?? p.kind}
                  </b>
                  <small>
                    {when(p.paid_at)} · {METHOD[p.method] ?? p.method}
                    {p.note ? ` · ${p.note}` : ""}
                  </small>
                  {p.voided_at ? (
                    <small className={styles.voidText}>Void: {p.void_reason}</small>
                  ) : (
                    <small>
                      {p.emailed_at ? `Emailed ${when(p.emailed_at)}` : "Not emailed"}
                      {p.whatsapped_at ? ` · WhatsApp ${when(p.whatsapped_at)}` : ""}
                    </small>
                  )}
                </span>
                <b className={styles.amount}>
                  {p.kind === "refund" ? "−" : ""}
                  {formatRM(Number(p.amount))}
                </b>
              </div>
              <div className={styles.btns}>
                <a href={`/receipt/${p.receipt_token}`} target="_blank" rel="noopener noreferrer" className={styles.btn}>
                  View
                </a>
                {!p.voided_at && (
                  <>
                    <button type="button" className={styles.btn} disabled={!hasEmail || busy !== null} title={hasEmail ? "" : "No email on this booking"} onClick={() => send(p, "email")}>
                      {busy === p.id + "email" ? "Sending…" : "Email"}
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.btnWa}`} disabled={busy !== null} onClick={() => send(p, "whatsapp")}>
                      WhatsApp
                    </button>
                  </>
                )}
                {p.proof_path && (
                  <button type="button" className={styles.btn} onClick={() => openProof(p.proof_path!)}>
                    Proof
                  </button>
                )}
                {!p.voided_at && (
                  <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setVoiding(p)}>
                    Void
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={msg.ok ? styles.ok : styles.err}>{msg.text}</p>}
      <button type="button" className={styles.add} onClick={() => setAdding(true)}>
        + Record payment
      </button>

      {adding && (
        <RecordPayment
          bookingId={bookingId}
          supabase={supabase}
          onClose={() => setAdding(false)}
          onDone={(no) => {
            setAdding(false);
            setMsg({ ok: true, text: `Recorded. Receipt ${no} issued.` });
            router.refresh();
          }}
        />
      )}
      {voiding && (
        <VoidDialog
          payment={voiding}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null);
            setMsg({ ok: true, text: "Receipt voided. Its number is kept so the sequence stays complete." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RecordPayment({
  bookingId,
  supabase,
  onClose,
  onDone,
}: {
  bookingId: string;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onDone: (receiptNo: string) => void;
}) {
  const now = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "T");
  const [f, setF] = useState({ kind: "balance", method: "cash", amount: "", paidAt: now, note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!(Number(f.amount) > 0)) return setError("Enter the amount in RM.");
    setBusy(true);
    let proofPath: string | null = null;
    if (file) {
      proofPath = `${bookingId}/payment-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60)}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(proofPath, file);
      if (upErr) {
        setBusy(false);
        return setError("The proof file did not upload. Try again, or save without it.");
      }
    }
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, ...f, amount: Number(f.amount), proofPath }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Not saved.");
    onDone(json.receiptNo);
  };

  return (
    <div className={ax.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={ax.dialog} role="dialog" aria-modal="true" aria-labelledby="rec-pay">
        <h2 id="rec-pay">Record a payment</h2>
        <p>For money that was not marked through the booking buttons, e.g. a top-up or cash at the jetty. A numbered receipt is issued.</p>
        <div className={ax.pair}>
          <label className={ax.field} htmlFor="rp-kind">
            Type
            <select id="rp-kind" value={f.kind} onChange={set("kind")}>
              <option value="balance">Balance</option>
              <option value="deposit">Deposit</option>
              <option value="full">Full payment</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className={ax.field} htmlFor="rp-method">
            Method
            <select id="rp-method" value={f.method} onChange={set("method")}>
              {Object.entries(METHOD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={ax.pair}>
          <label className={ax.field} htmlFor="rp-amount">
            Amount (RM)
            <input id="rp-amount" type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={set("amount")} />
          </label>
          <label className={ax.field} htmlFor="rp-at">
            Paid on
            <input id="rp-at" type="datetime-local" value={f.paidAt} onChange={set("paidAt")} />
          </label>
        </div>
        <label className={ax.field} htmlFor="rp-note">
          Note (printed on the receipt)
          <input id="rp-note" maxLength={200} value={f.note} onChange={set("note")} placeholder="e.g. Transfer ref 88213" />
        </label>
        <div className={ax.field}>
          Proof of payment (optional)
          <button type="button" className={`${ax.btn} ${ax.btnGhost}`} onClick={() => fileRef.current?.click()}>
            {file ? file.name : "Choose photo or PDF"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        {error && <p className={ax.err}>{error}</p>}
        <div className={ax.actions}>
          <button type="button" className={`${ax.btn} ${ax.btnGhost}`} disabled={busy} onClick={onClose}>
            Close
          </button>
          <button type="button" className={`${ax.btn} ${ax.btnPrimary}`} disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save and issue receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoidDialog({ payment, onClose, onDone }: { payment: PaymentRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={ax.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={ax.dialog} role="dialog" aria-modal="true" aria-labelledby="void-pay">
        <h2 id="void-pay">Void {payment.receipt_no}?</h2>
        <p>The receipt stays in the records marked VOID; its number is not reused. Use this for a mistake, not for a refund.</p>
        <label className={ax.field} htmlFor="void-reason">
          Reason
          <input id="void-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" />
        </label>
        {error && <p className={ax.err}>{error}</p>}
        <div className={ax.actions}>
          <button type="button" className={`${ax.btn} ${ax.btnGhost}`} disabled={busy} onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className={`${ax.btn} ${ax.btnDanger}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { ok, json } = await paymentAction(payment.id, { action: "void", reason });
              setBusy(false);
              if (!ok) return setError(json.error ?? "Not saved.");
              onDone();
            }}
          >
            {busy ? "Voiding…" : "Void receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
