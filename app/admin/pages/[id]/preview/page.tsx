import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@puckeditor/core/rsc";
import { createClient } from "@/lib/supabase/server";
import { requirePageEditor } from "@/lib/admin/operator";
import PageShell from "@/components/public/PageShell";
import { builderConfig, type PageData } from "@/lib/builder/config";
import { cleanPageData } from "@/lib/builder/sanitize";
import { DEFAULT_WA, waGeneral, waLink } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = { title: "Preview | Sakura Tackle", robots: { index: false, follow: false } };

/** A built page's draft, exactly as visitors would see it once published.
 *  Only admins and editors can open it; it is cleaned like a publish. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageEditor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: page }, { data: org }] = await Promise.all([
    supabase.from("site_pages").select("slug, draft").eq("id", id).maybeSingle(),
    supabase.from("org_settings").select("business_name, whatsapp_number").eq("id", 1).maybeSingle(),
  ]);
  if (!page) notFound();
  const wa = org?.whatsapp_number ?? DEFAULT_WA;
  const data: PageData = cleanPageData(page.draft);

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "8px 16px",
          background: "#ffb800",
          color: "#2e1d6b",
          fontWeight: 700,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Preview of the draft. Visitors do not see this until you publish.
      </div>
      <PageShell waHref={waLink(wa, waGeneral(`/${page.slug}`))} businessName={org?.business_name ?? "Sakura Tackle"}>
        <Render config={builderConfig} data={data} metadata={{ pageUrl: `${SITE_URL}/${page.slug}`, waNumber: wa }} />
      </PageShell>
    </>
  );
}
