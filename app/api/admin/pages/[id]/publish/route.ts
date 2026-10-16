import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { pageEditorApi } from "@/lib/admin/pageAuth";
import { cleanPageData } from "@/lib/builder/sanitize";

// Publish (or unpublish) a built page. The editor sends its current data;
// it is cleaned (lib/builder/sanitize.ts), saved as both draft and published,
// kept as a revision, and the page's cache is refreshed. Runs as the signed-in
// user, so RLS (page editors only) applies to every write.

const MAX_BYTES = 800_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await pageEditorApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { data?: unknown; unpublish?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: page } = await supabase.from("site_pages").select("id, slug, status").eq("id", id).maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  if (body.unpublish) {
    const { data } = await supabase
      .from("site_pages")
      .update({ status: "draft", updated_by: auth.profile.userId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (!data?.length) return NextResponse.json({ error: "Not updated." }, { status: 500 });
    revalidatePath(`/${page.slug}`);
    return NextResponse.json({ ok: true, status: "draft" });
  }

  if (JSON.stringify(body.data ?? {}).length > MAX_BYTES) {
    return NextResponse.json({ error: "This page is too large. Split it into two pages." }, { status: 413 });
  }
  const clean = cleanPageData(body.data);
  const now = new Date().toISOString();

  const { data: saved } = await supabase
    .from("site_pages")
    .update({
      draft: clean,
      published: clean,
      status: "published",
      published_at: now,
      updated_by: auth.profile.userId,
      updated_at: now,
    })
    .eq("id", id)
    .select("id");
  if (!saved?.length) return NextResponse.json({ error: "Not published. Try again." }, { status: 500 });

  await supabase
    .from("site_page_revisions")
    .insert({ page_id: id, data: clean, published_by: auth.profile.userId })
    .select("id");

  revalidatePath(`/${page.slug}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true, status: "published", data: clean });
}
