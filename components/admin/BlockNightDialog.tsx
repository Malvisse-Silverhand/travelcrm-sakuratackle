"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/public/book/Icon";
import { formatLongDate } from "@/lib/season";
import { STATUS_LABEL } from "./bookingStatus";
import styles from "./bookingActions/bookingActions.module.css";

export const BLOCK_CATEGORIES = [
  { key: "repair", label: "Repair", icon: "wrench" },
  { key: "closed", label: "Closed", icon: "lock" },
  { key: "weather", label: "Weather", icon: "cloud" },
  { key: "private", label: "Private charter", icon: "users" },
  { key: "other", label: "Other", icon: "tag" },
] as const;

type Clash = { id: string; ref: string; full_name: string; status: string };

type Props = {
  boatId: string;
  boatCode: string;
  night: string;
  /** True when the night is blocked now: the dialog offers Unblock. */
  blocked: boolean;
  reason?: string | null;
  onClose: () => void;
};

/** Block or unblock one night for one boat (admins, or the boat's vendor).
 *  staff_block_night() creates the night if needed and returns the live
 *  bookings on it, which are listed here so nobody is surprised. */
export default function BlockNightDialog({ boatId, boatCode, night, blocked, reason, onClose }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<string>("repair");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<Clash[] | null>(null);

  const submit = async (block: boolean) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("staff_block_night", {
      p_boat: boatId,
      p_night: night,
      p_block: block,
      p_category: block ? category : null,
      p_reason: block ? text.trim() || null : null,
    });
    setBusy(false);
    if (rpcError) {
      const m = rpcError.message;
      return setError(
        m.includes("not allowed")
          ? "You can only block your own boats."
          : m.includes("night has passed")
            ? "That night has passed."
            : "Nothing was saved. Try again."
      );
    }
    router.refresh();
    const list = (data ?? []) as Clash[];
    if (block && list.length > 0) return setClashes(list);
    onClose();
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`blk-${boatId}-${night}`}>
        <h2 id={`blk-${boatId}-${night}`}>
          {blocked ? "Open" : "Block"} {boatCode}, {formatLongDate(night)}
        </h2>

        {clashes ? (
          <>
            <div className={`${styles.quote}`} style={{ background: "rgba(239,68,68,0.08)", color: "var(--danger-text)" }}>
              Blocked. {clashes.length === 1 ? "This booking is" : `These ${clashes.length} bookings are`} still on that night.
              Weather-hold or move {clashes.length === 1 ? "it" : "them"} so the customers are not left waiting:
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {clashes.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/bookings/${c.id}`}>
                    {c.ref}, {c.full_name}
                  </Link>{" "}
                  ({STATUS_LABEL[c.status] ?? c.status})
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : blocked ? (
          <>
            <p>Blocked{reason ? `: ${reason}` : ""}. Opening it puts the night back on sale for this boat.</p>
            {error && <p className={styles.err}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={onClose}>
                Keep blocked
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy} onClick={() => submit(false)}>
                {busy ? "Opening…" : "Open the night"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Customers cannot book this boat on this night until it is opened again. Other boats are not affected.</p>
            <div className={styles.field}>
              Why
              <div className={styles.chips}>
                {BLOCK_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`${styles.chip} ${category === c.key ? styles.chipOn : ""}`}
                    onClick={() => setCategory(c.key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Icon name={c.icon} size={15} /> {c.label}
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.field} htmlFor={`blk-reason-${boatId}-${night}`}>
              Note (optional)
              <input
                id={`blk-reason-${boatId}-${night}`}
                value={text}
                maxLength={300}
                placeholder="e.g. Engine service, back on Friday"
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            {error && <p className={styles.err}>{error}</p>}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled={busy} onClick={onClose}>
                Close
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={busy} onClick={() => submit(true)}>
                {busy ? "Blocking…" : "Block this night"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A button that opens the dialog; for server-rendered screens. */
export function BlockNightButton(props: Omit<Props, "onClose"> & { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const { className, label, ...rest } = props;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label ?? (rest.blocked ? "Open night" : "Block night")}
      </button>
      {open && <BlockNightDialog {...rest} onClose={() => setOpen(false)} />}
    </>
  );
}
