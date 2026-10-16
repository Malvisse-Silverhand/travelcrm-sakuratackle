"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { createClient } from "@/lib/supabase/client";
import { builderConfig } from "@/lib/builder/config";
import PageSettings, { type PageMeta } from "./PageSettings";
import ed from "@/lib/builder/editor.module.css";

const VIEWPORTS = [
  { width: 390, label: "Phone", icon: "Smartphone" as const },
  { width: 820, label: "Tablet", icon: "Tablet" as const },
  { width: 1280, label: "Desktop", icon: "Monitor" as const },
];

/** The page builder: Puck full screen, with Save draft, Preview, Settings
 *  and Publish in the header. Drafts save through the browser client (RLS:
 *  admins and editors); publishing goes through the server, which cleans
 *  the page and keeps a revision. */
export default function PageEditor({
  page,
  siteUrl,
  waNumber,
}: {
  page: PageMeta & { id: string; draft: Data; status: "draft" | "published" };
  siteUrl: string;
  waNumber: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [meta, setMeta] = useState<PageMeta>({
    title: page.title,
    slug: page.slug,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    og_image: page.og_image,
    noindex: page.noindex,
  });
  const [status, setStatus] = useState(page.status);
  const data = useRef<Data>(page.draft);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "publish" | "unpublish">(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveDraft = useCallback(async () => {
    setBusy("save");
    setNote(null);
    const { data: me } = await supabase.auth.getUser();
    const { data: rows } = await supabase
      .from("site_pages")
      .update({ draft: data.current, updated_by: me.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", page.id)
      .select("id");
    setBusy(null);
    if (!rows?.length) return setNote({ ok: false, text: "Not saved. Check your connection and try again." });
    setDirty(false);
    setNote({ ok: true, text: "Draft saved." });
  }, [supabase, page.id]);

  const publish = useCallback(async () => {
    setBusy("publish");
    setNote(null);
    try {
      const res = await fetch(`/api/admin/pages/${page.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: data.current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Not published.");
      setStatus("published");
      setDirty(false);
      setNote({ ok: true, text: "Published. The page is live." });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Not published." });
    }
    setBusy(null);
  }, [page.id]);

  const unpublish = useCallback(async () => {
    if (!window.confirm("Take this page offline? Visitors will see 'page not found' until you publish again.")) return;
    setBusy("unpublish");
    const res = await fetch(`/api/admin/pages/${page.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unpublish: true }),
    });
    setBusy(null);
    if (res.ok) {
      setStatus("draft");
      setNote({ ok: true, text: "Taken offline. It is a draft again." });
    } else setNote({ ok: false, text: "Could not take it offline. Try again." });
  }, [page.id]);

  // Ctrl/Cmd+S saves the draft.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDraft]);

  const liveUrl = `${siteUrl}/${meta.slug}`;

  return (
    <div className={ed.editorShell}>
      <Puck
        config={builderConfig}
        data={page.draft}
        headerTitle={meta.title}
        headerPath={`/${meta.slug}`}
        viewports={VIEWPORTS}
        iframe={{ enabled: false }}
        metadata={{ pageUrl: liveUrl, waNumber }}
        onChange={(d) => {
          data.current = d;
          setDirty(true);
          setNote(null);
        }}
        onPublish={publish}
        overrides={{
          headerActions: () => (
            <div className={ed.headerActions}>
              <Link href="/admin/pages" className={ed.btnGhost}>
                ← Pages
              </Link>
              <span className={`${ed.statusPill} ${status === "published" ? ed.statusLive : ed.statusDraft}`}>
                {status === "published" ? "Live" : "Draft"}
              </span>
              {note ? (
                <span className={note.ok ? ed.ok : ed.err}>{note.text}</span>
              ) : (
                dirty && <span className={ed.saveState}>Unsaved changes</span>
              )}
              <button type="button" className={ed.btnGhost} onClick={() => setSettingsOpen(true)}>
                Settings
              </button>
              <button type="button" className={ed.btnGhost} disabled={busy !== null} onClick={saveDraft}>
                {busy === "save" ? "Saving…" : "Save draft"}
              </button>
              <a
                href={`/admin/pages/${page.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className={ed.btnGhost}
                onClick={() => {
                  if (dirty) saveDraft();
                }}
              >
                Preview
              </a>
              {status === "published" && (
                <>
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={ed.btnGhost}>
                    View live
                  </a>
                  <button type="button" className={ed.btnGhost} disabled={busy !== null} onClick={unpublish}>
                    Unpublish
                  </button>
                </>
              )}
              <button type="button" className={ed.btnPrimary} disabled={busy !== null} onClick={publish}>
                {busy === "publish" ? "Publishing…" : status === "published" ? "Update live page" : "Publish"}
              </button>
            </div>
          ),
        }}
      />
      {settingsOpen && (
        <PageSettings
          pageId={page.id}
          siteUrl={siteUrl}
          meta={meta}
          onClose={() => setSettingsOpen(false)}
          onSaved={(m) => {
            setMeta(m);
            setNote({ ok: true, text: "Settings saved." });
          }}
        />
      )}
    </div>
  );
}
