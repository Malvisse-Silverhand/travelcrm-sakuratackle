import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Data } from "@puckeditor/core";
import { createClient } from "@/lib/supabase/server";
import { requirePageEditor } from "@/lib/admin/operator";
import PageEditor from "@/components/admin/pages/PageEditor";
import { SITE_URL } from "@/lib/site-url";
import { DEFAULT_WA } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Page editor | Sakura Tackle admin", robots: { index: false } };

/** The page builder, full screen (outside the admin sidebar layout). */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageEditor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: page }, { data: org }] = await Promise.all([
    supabase
      .from("site_pages")
      .select("id, slug, title, seo_title, seo_description, og_image, noindex, draft, status")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("org_settings").select("whatsapp_number").eq("id", 1).maybeSingle(),
  ]);
  if (!page) notFound();

  return (
    <PageEditor
      page={{ ...page, draft: page.draft as Data }}
      siteUrl={SITE_URL}
      waNumber={org?.whatsapp_number ?? DEFAULT_WA}
    />
  );
}
