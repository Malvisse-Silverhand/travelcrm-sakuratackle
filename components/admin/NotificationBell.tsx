"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./NotificationBell.module.css";

/** Activity worth interrupting an admin for. Everything else stays in the
 *  Activity log. Written by the bookings trigger and the invite routes
 *  (supabase/migrations/20261015110000_selling_fast_and_notifications.sql). */
const KINDS: Record<string, { label: string; tone: "red" | "gold" | "green" | "purple" }> = {
  "booking.conflict": { label: "Double booking", tone: "red" },
  "receipt.uploaded": { label: "Receipt to verify", tone: "gold" },
  "booking.created": { label: "New booking", tone: "green" },
  "booking.cancelled": { label: "Cancelled", tone: "red" },
  "booking.expired": { label: "Hold expired", tone: "gold" },
  "user.joined": { label: "New team member", tone: "purple" },
};

type Item = {
  id: number;
  at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
};

const POLL_MS = 60_000;

/** Header bell for admins: important events since the admin last opened it.
 *  Polls once a minute; opening the list marks everything as read. Vendors
 *  cannot read activity_log, so the bell renders nothing for them. */
export default function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  /** seenAt as it was when the list was opened, so the items that were new
   *  stay highlighted while the admin reads them. */
  const [openedSeenAt, setOpenedSeenAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(
    (uid: string) =>
      Promise.all([
        supabase
          .from("activity_log")
          .select("id, at, action, entity, entity_id, summary")
          .in("action", Object.keys(KINDS))
          .order("at", { ascending: false })
          .limit(30),
        supabase.from("admin_notification_state").select("seen_at").eq("user_id", uid).maybeSingle(),
      ]).then(([log, state]) => {
        setItems((log.data ?? []) as Item[]);
        setSeenAt(state.data?.seen_at ?? null);
      }),
    [supabase]
  );

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (cancelled || me?.role !== "operator") return;
      setUserId(uid);
      load(uid);
      timer = setInterval(() => {
        if (document.visibilityState === "visible") load(uid);
      }, POLL_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [supabase, load]);

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!userId) return null;

  const isNew = (it: Item, since: string | null) => !since || it.at > since;
  const unread = items.filter((it) => isNew(it, seenAt)).length;

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpenedSeenAt(seenAt);
    setOpen(true);
    if (unread === 0) return;
    const now = new Date().toISOString();
    setSeenAt(now);
    await supabase
      .from("admin_notification_state")
      .upsert({ user_id: userId, seen_at: now })
      .select("user_id");
  };

  return (
    <div ref={wrap} className={styles.wrap}>
      <button
        type="button"
        className={styles.bell}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className={styles.count}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.head}>
            <span className={styles.title}>Notifications</span>
            <Link href="/admin/activity" className={styles.all} onClick={() => setOpen(false)}>
              Activity log
            </Link>
          </div>
          {items.length === 0 ? (
            <p className={styles.empty}>Nothing important yet.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((it) => {
                const kind = KINDS[it.action];
                const href =
                  it.entity === "booking" && it.entity_id
                    ? `/admin/bookings/${it.entity_id}`
                    : it.entity === "user"
                      ? "/admin/users"
                      : "/admin/activity";
                return (
                  <li key={it.id}>
                    <Link
                      href={href}
                      className={`${styles.item} ${isNew(it, openedSeenAt) ? styles.itemNew : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className={`${styles.dot} ${styles[kind.tone]}`} aria-hidden="true" />
                      <span className={styles.body}>
                        <span className={styles.kind}>{kind.label}</span>
                        <span className={styles.summary}>{it.summary}</span>
                        <span className={styles.time}>{timeAgo(it.at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
}
