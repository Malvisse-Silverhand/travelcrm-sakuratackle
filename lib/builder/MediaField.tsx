"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./editor.module.css";

export type MediaValue = { url: string; alt: string; width?: number; height?: number } | null;

type Item = { id: string; url: string; alt: string; width: number | null; height: number | null };

/** Editor field: pick an image from the media library or upload a new one
 *  (resized and stored by /api/admin/media). Alt text is required. */
export default function MediaField({
  value,
  onChange,
}: {
  value: MediaValue;
  onChange: (v: MediaValue) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items) return;
    supabase
      .from("site_media")
      .select("id, url, alt, width, height")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, [open, items, supabase]);

  const upload = async () => {
    if (!file || !alt.trim()) return;
    setBusy(true);
    setErr(null);
    const body = new FormData();
    body.set("file", file);
    body.set("alt", alt.trim());
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      onChange({ url: json.url, alt: json.alt, width: json.width, height: json.height });
      setItems(null);
      setFile(null);
      setAlt("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    }
    setBusy(false);
  };

  return (
    <div className={styles.mediaField}>
      {value?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.url} alt={value.alt} className={styles.mediaThumb} />
      ) : (
        <div className={styles.mediaEmpty}>No image</div>
      )}
      <div className={styles.mediaRow}>
        <button type="button" className={styles.btn} onClick={() => setOpen(!open)}>
          {open ? "Close" : value?.url ? "Change image" : "Choose image"}
        </button>
        {value?.url && (
          <button type="button" className={styles.btnGhost} onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {value?.url && (
        <label className={styles.mediaAlt}>
          <span>Alt text (describes the image)</span>
          <input value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
        </label>
      )}
      {open && (
        <div className={styles.mediaPanel}>
          <div className={styles.mediaUpload}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <input
              placeholder="Alt text, e.g. Group candat at night"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
            <button type="button" className={styles.btn} disabled={!file || !alt.trim() || busy} onClick={upload}>
              {busy ? "Uploading…" : "Upload"}
            </button>
            {err && <span className={styles.err}>{err}</span>}
          </div>
          <div className={styles.mediaGrid}>
            {items === null && <span>Loading…</span>}
            {items?.length === 0 && <span>No images yet. Upload one above.</span>}
            {items?.map((m) => (
              <button
                key={m.id}
                type="button"
                className={styles.mediaPick}
                onClick={() => {
                  onChange({ url: m.url, alt: m.alt, width: m.width ?? undefined, height: m.height ?? undefined });
                  setOpen(false);
                }}
                title={m.alt}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
