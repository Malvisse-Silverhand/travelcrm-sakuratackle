"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../../app/admin/admin.module.css";

export type JettyRow = {
  id: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  open: boolean;
  sort_order: number;
  /** Active boats assigned to it. */
  boats: number;
};

type Draft = { name: string; subtitle: string; lat: string; lng: string; open: boolean };

const toDraft = (j: JettyRow): Draft => ({
  name: j.name,
  subtitle: j.subtitle,
  lat: String(j.lat),
  lng: String(j.lng),
  open: j.open,
});

const EMPTY: Draft = { name: "", subtitle: "", lat: "", lng: "", open: false };

function check(d: Draft): string | null {
  if (d.name.trim().length < 2 || d.name.trim().length > 60) return "Name must be 2 to 60 characters.";
  const lat = Number(d.lat);
  const lng = Number(d.lng);
  if (!d.lat.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude must be a number like 5.2066.";
  if (!d.lng.trim() || !Number.isFinite(lng) || lng < -180 || lng > 180) return "Longitude must be a number like 103.2058.";
  return null;
}

/** Jetties on the homepage search and map. A boat sails from one jetty (set
 *  on the boat in Fleet); only open jetties take bookings, the rest show as
 *  "Coming Soon". */
export default function JettySettings({ jetties }: { jetties: JettyRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(jetties.map((j) => [j.id, toDraft(j)]))
  );
  const [adding, setAdding] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, k: keyof Draft, v: string | boolean) =>
    setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], [k]: v } }));

  const save = async (j: JettyRow) => {
    const d = drafts[j.id];
    const err = check(d);
    if (err) return setMsg({ ok: false, text: `${j.name}: ${err}` });
    if (j.open && !d.open && j.boats > 0) {
      const ok = window.confirm(
        `${j.boats} active boat${j.boats === 1 ? "" : "s"} sail from ${j.name}. Marking it Coming Soon stops new bookings for ${j.boats === 1 ? "it" : "them"}. Continue?`
      );
      if (!ok) return;
    }
    setBusy(j.id);
    setMsg(null);
    const { data, error } = await supabase
      .from("jetties")
      .update({
        name: d.name.trim(),
        subtitle: d.subtitle.trim(),
        lat: Number(d.lat),
        lng: Number(d.lng),
        open: d.open,
      })
      .eq("id", j.id)
      .select("id");
    setBusy(null);
    if (error || !data?.length) return setMsg({ ok: false, text: "Save failed. Try again." });
    setMsg({ ok: true, text: `${d.name.trim()} saved.` });
    router.refresh();
  };

  const add = async () => {
    const err = check(adding);
    if (err) return setMsg({ ok: false, text: err });
    const id = adding.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    if (id.length < 2) return setMsg({ ok: false, text: "Use letters in the name." });
    setBusy("new");
    setMsg(null);
    const { data, error } = await supabase
      .from("jetties")
      .insert({
        id,
        name: adding.name.trim(),
        subtitle: adding.subtitle.trim(),
        lat: Number(adding.lat),
        lng: Number(adding.lng),
        open: adding.open,
        sort_order: jetties.length + 1,
      })
      .select("id");
    setBusy(null);
    if (error || !data?.length) {
      return setMsg({
        ok: false,
        text: error?.code === "23505" ? "A jetty with that name already exists." : "Could not add the jetty.",
      });
    }
    setDrafts((cur) => ({ ...cur, [id]: { ...adding } }));
    setAdding(EMPTY);
    setMsg({ ok: true, text: "Jetty added. Assign boats to it in Fleet." });
    router.refresh();
  };

  const row = (d: Draft, on: (k: keyof Draft, v: string | boolean) => void) => (
    <>
      <input className={styles.input} value={d.name} onChange={(e) => on("name", e.target.value)} placeholder="Name, e.g. Dungun" aria-label="Name" />
      <input className={styles.input} value={d.subtitle} onChange={(e) => on("subtitle", e.target.value)} placeholder="Shown under it, e.g. Jeti Dungun, Terengganu" aria-label="Subtitle" />
      <input className={styles.input} value={d.lat} onChange={(e) => on("lat", e.target.value)} placeholder="Latitude" inputMode="decimal" aria-label="Latitude" />
      <input className={styles.input} value={d.lng} onChange={(e) => on("lng", e.target.value)} placeholder="Longitude" inputMode="decimal" aria-label="Longitude" />
      <label className={styles.jettyOpen}>
        <input type="checkbox" checked={d.open} onChange={(e) => on("open", e.target.checked)} />
        Open
      </label>
    </>
  );

  return (
    <div className={styles.detailCard} style={{ margin: 0, gridColumn: "1 / -1" }}>
      <span className={styles.detailCardLabel}>Jetties</span>
      <p className={styles.emptyCardBody} style={{ margin: "4px 0 12px" }}>
        The homepage search lists these. Open jetties take bookings; the rest show as Coming
        Soon. Set each boat&apos;s jetty in Fleet. Coordinates: right-click the spot in Google
        Maps and copy the two numbers.
      </p>
      <div className={styles.jettyGrid}>
        <span className={styles.jettyHead}>Name</span>
        <span className={styles.jettyHead}>Subtitle</span>
        <span className={styles.jettyHead}>Latitude</span>
        <span className={styles.jettyHead}>Longitude</span>
        <span className={styles.jettyHead}>Status</span>
        <span className={styles.jettyHead} />
        {jetties.map((j) => (
          <div key={j.id} className={styles.jettyRow}>
            {row(drafts[j.id] ?? toDraft(j), (k, v) => patch(j.id, k, v))}
            <button
              type="button"
              className={`${styles.dtBtn} ${styles.dtBtnGhost}`}
              disabled={busy !== null}
              onClick={() => save(j)}
              title={`${j.boats} active boat${j.boats === 1 ? "" : "s"}`}
            >
              {busy === j.id ? "Saving…" : `Save (${j.boats} boat${j.boats === 1 ? "" : "s"})`}
            </button>
          </div>
        ))}
        <div className={styles.jettyRow}>
          {row(adding, (k, v) => setAdding((cur) => ({ ...cur, [k]: v })))}
          <button type="button" className={styles.dtBtn} disabled={busy !== null} onClick={add}>
            {busy === "new" ? "Adding…" : "Add jetty"}
          </button>
        </div>
      </div>
      {msg && (
        <p className={msg.ok ? styles.formOk : styles.formErr} style={{ marginTop: 10 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
