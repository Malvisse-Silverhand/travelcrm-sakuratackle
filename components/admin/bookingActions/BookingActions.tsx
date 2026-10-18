"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTION_HINT,
  ACTION_LABEL,
  DANGER,
  allowedActions,
  jettyBalance,
  primaryAction,
  waTemplateFor,
  type ActionKey,
  type ActionState,
} from "@/lib/booking/actions";
import { upfrontAmount } from "@/lib/booking/amounts";
import { waTemplate, waToCustomer } from "@/lib/admin/waTemplates";
import CancelDialog from "./CancelDialog";
import MoveDialog, { type MoveBoat } from "./MoveDialog";
import styles from "./bookingActions.module.css";

export type ActionBooking = ActionState & {
  id: string;
  ref: string;
  full_name: string;
  phone: string;
  pax: number;
  boat_id: string;
  boat_code: string;
};

type Props = {
  booking: ActionBooking;
  boats: MoveBoat[];
  today: string;
  /** "row" for the Bookings list, "panel" for the booking detail page. */
  variant?: "row" | "panel";
};

/** Actions that open a dialog instead of running straight away. */
const DIALOG: ActionKey[] = ["cancel", "move"];
/** Actions that ask for a second click before running. */
const CONFIRM: ActionKey[] = ["undo_deposit", "undo_balance", "no_show", "clear_outcome", "release_hold"];

const PANEL_GROUPS: Array<{ label: string; keys: ActionKey[] }> = [
  { label: "Payment", keys: ["accept", "mark_deposit", "mark_balance", "refund_paid", "undo_deposit", "undo_balance"] },
  { label: "Trip", keys: ["move", "weather_hold", "release_hold", "complete", "no_show", "clear_outcome"] },
  { label: "Customer", keys: ["resend_email"] },
  { label: "", keys: ["cancel"] },
];

export async function postAction(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/bookings/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok
    ? { ok: true as const, message: String(json.message ?? "Done."), emailed: json.emailed as boolean | null | undefined }
    : { ok: false as const, error: String(json.error ?? "Something went wrong. Try again.") };
}

export function waFor(b: ActionBooking, today: string, template = waTemplateFor(b, today)): string {
  const text = waTemplate(template, {
    ref: b.ref,
    fullName: b.full_name,
    nightDate: b.night_date,
    boatCode: b.boat_code,
    pax: b.pax,
    totalAmount: Number(b.total_amount),
    balanceDue: jettyBalance(b),
    depositAmount: upfrontAmount(b),
    depositPaid: b.deposit_paid,
  });
  return waToCustomer(b.phone, text);
}

/** The status-aware buttons for one booking: the next step, WhatsApp with
 *  the right message, and everything else in a menu or panel. */
export default function BookingActions({ booking: b, boats, today, variant = "row" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [armed, setArmed] = useState<ActionKey | null>(null);
  const [dialog, setDialog] = useState<ActionKey | null>(null);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  const allowed = allowedActions(b, today);
  const primary = primaryAction(b, today);
  const primaryKey = primary?.kind === "action" ? primary.key : null;

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      setMenu(null);
      setArmed(null);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.(`[data-menu="${b.id}"]`)) close(e);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", close);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menu, b.id]);

  const run = async (key: ActionKey) => {
    if (DIALOG.includes(key)) {
      setMenu(null);
      setDialog(key);
      return;
    }
    if (CONFIRM.includes(key) && armed !== key) {
      setArmed(key);
      return;
    }
    setArmed(null);
    setMenu(null);
    setBusy(key);
    setToast(null);
    const r = await postAction(b.id, { action: key });
    setBusy(null);
    if (!r.ok) return setToast({ ok: false, text: r.error });
    setToast({
      ok: true,
      text: r.message + (r.emailed === true ? " Email sent." : r.emailed === false ? " (No email sent.)" : ""),
    });
    router.refresh();
  };

  const openMenu = () => {
    if (menu) return setMenu(null);
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 260;
    setMenu({ top: Math.min(r.bottom + 6, window.innerHeight - 200), left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  };

  const label = (k: ActionKey) => (armed === k ? `Click again: ${ACTION_LABEL[k].toLowerCase()}` : ACTION_LABEL[k]);

  const primaryButton =
    primary?.kind === "action" ? (
      <button type="button" className={styles.primary} disabled={busy !== null} onClick={() => run(primary.key)}>
        {busy === primary.key ? "Working…" : ACTION_LABEL[primary.key]}
      </button>
    ) : primary?.kind === "wa" ? (
      <a href={waFor(b, today, primary.template)} target="_blank" rel="noopener noreferrer" className={styles.primary}>
        {primary.label}
      </a>
    ) : null;

  const waButton = (
    <a href={waFor(b, today)} target="_blank" rel="noopener noreferrer" className={styles.wa}>
      WhatsApp
    </a>
  );

  const dialogs = (
    <>
      {dialog === "cancel" && (
        <CancelDialog
          booking={b}
          today={today}
          onClose={() => {
            setDialog(null);
            // Refresh only now: the cancelled row may leave the current tab,
            // which would close the dialog before the WhatsApp step.
            if (cancelled.current) router.refresh();
          }}
          onDone={(text) => {
            cancelled.current = true;
            setToast({ ok: true, text });
          }}
        />
      )}
      {dialog === "move" && (
        <MoveDialog
          booking={b}
          boats={boats}
          today={today}
          onClose={() => setDialog(null)}
          onDone={(text) => {
            setDialog(null);
            setToast({ ok: true, text });
            router.refresh();
          }}
        />
      )}
    </>
  );

  if (variant === "panel") {
    return (
      <div className={styles.panel}>
        {primaryButton}
        {waButton}
        {PANEL_GROUPS.map((g) => {
          const keys = g.keys.filter((k) => allowed.includes(k) && k !== primaryKey);
          if (!keys.length) return null;
          return (
            <div key={g.label || "end"} className={styles.panelGroup}>
              {g.label && <span className={styles.panelLabel}>{g.label}</span>}
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={busy !== null}
                  className={[
                    styles.panelBtn,
                    DANGER.includes(k) ? styles.panelBtnDanger : "",
                    armed === k ? styles.panelBtnArmed : "",
                  ].join(" ")}
                  onClick={() => run(k)}
                >
                  <span>
                    {busy === k ? "Working…" : label(k)}
                    {ACTION_HINT[k] && <small>{ACTION_HINT[k]}</small>}
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          );
        })}
        {toast && <p className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>{toast.text}</p>}
        {dialogs}
      </div>
    );
  }

  const menuKeys = allowed.filter((k) => k !== primaryKey);
  return (
    <div>
      <div className={styles.row}>
        {primaryButton}
        {waButton}
        <button
          ref={moreRef}
          type="button"
          className={styles.more}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          aria-label={`More actions for ${b.ref}`}
          data-menu={b.id}
          onClick={openMenu}
        >
          ⋯
        </button>
      </div>
      {toast && <p className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>{toast.text}</p>}
      {menu && (
        <div className={styles.menu} role="menu" style={{ top: menu.top, left: menu.left }} data-menu={b.id}>
          <Link href={`/admin/bookings/${b.id}`} className={styles.item} role="menuitem">
            Open booking
          </Link>
          {menuKeys.length > 0 && <div className={styles.sep} />}
          {menuKeys.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              className={[styles.item, DANGER.includes(k) ? styles.itemDanger : "", armed === k ? styles.itemArmed : ""].join(" ")}
              onClick={() => run(k)}
            >
              {label(k)}
              {ACTION_HINT[k] && <small>{ACTION_HINT[k]}</small>}
            </button>
          ))}
        </div>
      )}
      {dialogs}
    </div>
  );
}
