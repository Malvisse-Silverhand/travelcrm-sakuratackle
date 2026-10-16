"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DataTable, { type Column, type Tab } from "../DataTable";
import { TEMPLATES, slugify, templateData, type TemplateKey } from "@/lib/builder/templates";
import styles from "../../../app/admin/admin.module.css";
import ed from "@/lib/builder/editor.module.css";

export type PageListRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  updated_at: string;
  published_at: string | null;
  editor: string;
};

const TABS: Tab<PageListRow>[] = [
  { key: "all", label: "All", test: () => true },
  { key: "published", label: "Published", test: (p) => p.status === "published" },
  { key: "draft", label: "Drafts", test: (p) => p.status === "draft" },
];

const SEARCH = {
  placeholder: "Search title or address…",
  text: (p: PageListRow) => `${p.title} ${p.slug}`,
};

/** Database refusals in plain words. */
function slugError(code: string | undefined, message: string | undefined): string {
  if (code === "23505") return "That address is already used by another page.";
  if (code === "23514" && message?.includes("reserved")) return "That address is used by the site itself. Pick another.";
  if (code === "23514") return "Use lowercase letters, numbers and dashes for the address.";
  return "Could not create the page. Try again.";
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

/** The page builder's page list: create (from a template), edit, view,
 *  duplicate and delete. */
export default function PagesTable({ rows, siteUrl }: { rows: PageListRow[]; siteUrl: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("campaign");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const create = async () => {
    const t = title.trim();
    const s = slugify(slug || t);
    if (!t || !s) return setMsg({ ok: false, text: "Give the page a title." });
    setBusy(true);
    setMsg(null);
    const { data: me } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("site_pages")
      .insert({
        title: t,
        slug: s,
        draft: templateData(template, t),
        created_by: me.user?.id ?? null,
        updated_by: me.user?.id ?? null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return setMsg({ ok: false, text: slugError(error?.code, error?.message) });
    router.push(`/admin/pages/${data.id}`);
  };

  const duplicate = async (p: PageListRow) => {
    setMsg(null);
    const { data: src } = await supabase
      .from("site_pages")
      .select("title, draft, seo_title, seo_description, og_image, noindex")
      .eq("id", p.id)
      .single();
    if (!src) return setMsg({ ok: false, text: "Could not read that page." });
    const { data: me } = await supabase.auth.getUser();
    for (let n = 2; n < 20; n++) {
      const { data, error } = await supabase
        .from("site_pages")
        .insert({ ...src, title: `${src.title} (copy)`, slug: `${p.slug}-${n}`.slice(0, 60), created_by: me.user?.id, updated_by: me.user?.id })
        .select("id")
        .single();
      if (data) return router.push(`/admin/pages/${data.id}`);
      if (error?.code !== "23505") return setMsg({ ok: false, text: slugError(error?.code, error?.message) });
    }
  };

  const remove = async (p: PageListRow) => {
    if (!window.confirm(`Delete "${p.title}" (/${p.slug})? This cannot be undone.`)) return;
    const { data } = await supabase.from("site_pages").delete().eq("id", p.id).select("id");
    if (!data?.length) return setMsg({ ok: false, text: "Not deleted. Reload and try again." });
    setMsg({ ok: true, text: `"${p.title}" deleted.` });
    router.refresh();
  };

  const columns: Column<PageListRow>[] = [
    {
      key: "title",
      header: "Page",
      render: (p) => (
        <Link href={`/admin/pages/${p.id}`} className={styles.dtStrong}>
          {p.title}
        </Link>
      ),
    },
    { key: "slug", header: "Address", render: (p) => `/${p.slug}` },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <span className={`${ed.statusPill} ${p.status === "published" ? ed.statusLive : ed.statusDraft}`}>
          {p.status === "published" ? "Live" : "Draft"}
        </span>
      ),
    },
    { key: "edited", header: "Last edited", render: (p) => `${fmt(p.updated_at)} · ${p.editor}` },
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <div className={styles.dtActions}>
          <Link href={`/admin/pages/${p.id}`} className={`${styles.dtBtn} ${styles.dtBtnEdit}`}>
            Edit
          </Link>
          {p.status === "published" && (
            <a href={`${siteUrl}/${p.slug}`} target="_blank" rel="noopener noreferrer" className={`${styles.dtBtn} ${styles.dtBtnGhost}`}>
              View
            </a>
          )}
          <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => duplicate(p)}>
            Duplicate
          </button>
          <button type="button" className={`${styles.dtBtn} ${styles.dtBtnGhost}`} onClick={() => remove(p)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={ed.newForm}>
        <label className={ed.field}>
          New page title
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. Promo Merdeka 2027"
            maxLength={120}
          />
        </label>
        <label className={ed.field}>
          Address
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder="promo-merdeka-2027"
            maxLength={60}
          />
          <span className={ed.hint}>
            {siteUrl.replace(/^https:\/\//, "")}/{slugify(slug || title) || "…"}
          </span>
        </label>
        <label className={ed.field}>
          Start from
          <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)}>
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={ed.btnPrimary} disabled={busy || !title.trim()} onClick={create}>
          {busy ? "Creating…" : "Create page"}
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? styles.formOk : styles.formErr} style={{ margin: "0 0 12px" }}>
          {msg.text}
        </p>
      )}
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        columns={columns}
        tabs={TABS}
        search={SEARCH}
        emptyText="No pages yet. Create your first campaign page above."
      />
    </>
  );
}
