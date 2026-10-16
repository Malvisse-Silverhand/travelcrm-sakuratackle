import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site-url";

/** Published, indexable pages from the page builder. A cookie-free client:
 *  the sitemap needs only what the public can read. */
async function builtPages(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const { data } = await createClient(url, key, { auth: { persistSession: false } })
    .from("site_pages")
    .select("slug, published_at")
    .eq("status", "published")
    .eq("noindex", false);
  return (data ?? []).map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: p.published_at ?? undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...(await builtPages()),
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/destinasi/terengganu`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/polisi`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
