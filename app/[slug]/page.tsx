import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@puckeditor/core/rsc";
import { createClient } from "@/lib/supabase/server";
import PageShell from "@/components/public/PageShell";
import { builderConfig, type PageData } from "@/lib/builder/config";
import { waGeneral, waLink, DEFAULT_WA } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/site-url";

// Pages built in the admin page builder (/admin/pages), at /<slug>. Only
// published pages are visible: RLS returns nothing else to the public. Routes
// that exist in app/ (book, polisi, reviews…) always win over this one, and
// their names are reserved in the database so a page cannot take them.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type PageRow = {
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  noindex: boolean;
  published: PageData | null;
};

const loadPage = cache(async (slug: string) => {
  if (!SLUG.test(slug) || slug.length > 60) return null;
  const supabase = await createClient();
  const [{ data: page }, { data: org }] = await Promise.all([
    supabase
      .from("site_pages")
      .select("slug, title, seo_title, seo_description, og_image, noindex, published")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle<PageRow>(),
    supabase.from("org_settings").select("business_name, whatsapp_number").eq("id", 1).maybeSingle(),
  ]);
  if (!page?.published) return null;
  return { page, org };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadPage(slug);
  if (!found) return {};
  const { page } = found;
  const title = page.seo_title || `${page.title} | SAKURA TACKLE`;
  const description =
    page.seo_description || `${page.title}. Trip candat sotong bersama Sakura Tackle di Terengganu.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${page.slug}` },
    robots: page.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${page.slug}`,
      ...(page.og_image ? { images: [{ url: page.og_image }] } : {}),
    },
  };
}

export default async function BuiltPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await loadPage(slug);
  if (!found) notFound();
  const { page, org } = found;
  const wa = org?.whatsapp_number ?? DEFAULT_WA;
  const pageUrl = `${SITE_URL}/${page.slug}`;

  return (
    <PageShell waHref={waLink(wa, waGeneral(`/${page.slug}`))} businessName={org?.business_name ?? "Sakura Tackle"}>
      <Render config={builderConfig} data={page.published!} metadata={{ pageUrl, waNumber: wa }} />
    </PageShell>
  );
}
