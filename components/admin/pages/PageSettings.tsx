"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MediaField, { type MediaValue } from "@/lib/builder/MediaField";
import { slugify } from "@/lib/builder/templates";
import ed from "@/lib/builder/editor.module.css";

export type PageMeta = {
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  noindex: boolean;
};

/** Title, address and SEO for a built page, in a side panel. */
export default function PageSettings({
  pageId,
  siteUrl,
  meta,
  onClose,
  onSaved,
}: {
  pageId: string;
  siteUrl: string;
  meta: PageMeta;
  onClose: () => void;
  onSaved: (m: PageMeta) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [m, setM] = useState<PageMeta>(meta);
  const [image, setImage] = useState<MediaValue>(meta.og_image ? { url: meta.og_image, alt: "Share image" } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof PageMeta>(k: K, v: PageMeta[K]) => setM((cur) => ({ ...cur, [k]: v }));

  const save = async () => {
    const slug = slugify(m.slug);
    if (!m.title.trim()) return setErr("Give the page a title.");
    if (!slug) return setErr("Give the page an address.");
    setBusy(true);
    setErr(null);
    const next: PageMeta = {
      title: m.title.trim(),
      slug,
      seo_title: m.seo_title?.trim() || null,
      seo_description: m.seo_description?.trim() || null,
      og_image: image?.url ?? null,
      noindex: m.noindex,
    };
    const { data, error } = await supabase
      .from("site_pages")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", pageId)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setErr(
        error?.code === "23505"
          ? "That address is already used by another page."
          : error?.code === "23514"
            ? "That address is reserved or invalid. Use lowercase letters, numbers and dashes."
            : "Not saved. Try again."
      );
      return;
    }
    onSaved(next);
    onClose();
  };

  const shownTitle = m.seo_title?.trim() || `${m.title} | SAKURA TACKLE`;

  return (
    <div className={ed.overlay} onClick={onClose}>
      <div className={ed.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Page settings">
        <div className={ed.panelHead}>
          <h2 className={ed.panelTitle}>Page settings</h2>
          <button type="button" className={ed.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
        <label className={ed.field}>
          Title (in the page list and browser tab)
          <input value={m.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className={ed.field}>
          Address
          <input value={m.slug} maxLength={60} onChange={(e) => set("slug", e.target.value.toLowerCase())} />
          <span className={ed.hint}>
            {siteUrl.replace(/^https:\/\//, "")}/{slugify(m.slug) || "…"}. Changing it breaks links already shared.
          </span>
        </label>
        <label className={ed.field}>
          Google title <span className={ed.hint}>({(m.seo_title ?? "").length}/70, optional)</span>
          <input value={m.seo_title ?? ""} maxLength={70} onChange={(e) => set("seo_title", e.target.value)} />
        </label>
        <label className={ed.field}>
          Google description <span className={ed.hint}>({(m.seo_description ?? "").length}/200)</span>
          <textarea
            rows={3}
            value={m.seo_description ?? ""}
            maxLength={200}
            onChange={(e) => set("seo_description", e.target.value)}
          />
        </label>
        <div className={ed.seoPreview} aria-label="Google preview">
          <span>{siteUrl.replace(/^https:\/\//, "")}/{slugify(m.slug)}</span>
          <b>{shownTitle}</b>
          {m.seo_description || "Add a description so Google shows something useful."}
        </div>
        <div className={ed.field}>
          Share image (WhatsApp, Facebook)
          <MediaField value={image} onChange={setImage} />
        </div>
        <label className={ed.checkRow}>
          <input type="checkbox" checked={m.noindex} onChange={(e) => set("noindex", e.target.checked)} />
          Hide from Google (for private or test pages)
        </label>
        {err && <p className={ed.err}>{err}</p>}
        <div className={ed.panelFoot}>
          <button type="button" className={ed.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={ed.btnPrimary} disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
