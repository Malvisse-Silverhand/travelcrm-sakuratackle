"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ed from "@/lib/builder/editor.module.css";

export type MediaRow = {
  id: string;
  path: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  created_at: string;
};

/** The page builder's images: upload (resized to WebP on the server, alt
 *  text required), copy a link, delete. */
export default function MediaLibrary({ rows }: { rows: MediaRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async () => {
    if (!file || !alt.trim()) return;
    setBusy(true);
    setMsg(null);
    const body = new FormData();
    body.set("file", file);
    body.set("alt", alt.trim());
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      setMsg({ ok: true, text: "Uploaded." });
      setFile(null);
      setAlt("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed." });
    }
    setBusy(false);
  };

  const remove = async (m: MediaRow) => {
    if (!window.confirm("Delete this image? Pages that use it will show an empty space.")) return;
    await supabase.storage.from("site-media").remove([m.path]);
    const { data } = await supabase.from("site_media").delete().eq("id", m.id).select("id");
    setMsg(data?.length ? { ok: true, text: "Deleted." } : { ok: false, text: "Not deleted. Reload and try again." });
    router.refresh();
  };

  return (
    <>
      <div className={ed.libUpload}>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <input placeholder="Alt text: describe the image (required)" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} />
        <button type="button" className={ed.btnPrimary} disabled={!file || !alt.trim() || busy} onClick={upload}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        <span className={ed.hint}>JPG, PNG or WebP up to 5MB. Resized and compressed automatically.</span>
        {msg && <span className={msg.ok ? ed.ok : ed.err}>{msg.text}</span>}
      </div>
      {rows.length === 0 ? (
        <p className={ed.hint}>No images yet.</p>
      ) : (
        <div className={ed.libGrid}>
          {rows.map((m) => (
            <div key={m.id} className={ed.libItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt} loading="lazy" />
              <div className={ed.libMeta}>
                <span className={ed.libAlt} title={m.alt}>
                  {m.alt}
                </span>
                <span>
                  {m.width}×{m.height} · {m.bytes ? `${Math.round(m.bytes / 1024)} KB` : ""}
                </span>
                <div className={ed.mediaRow}>
                  <button
                    type="button"
                    className={ed.btnGhost}
                    onClick={() => {
                      navigator.clipboard?.writeText(m.url);
                      setMsg({ ok: true, text: "Link copied." });
                    }}
                  >
                    Copy link
                  </button>
                  <button type="button" className={ed.btnDanger} onClick={() => remove(m)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
