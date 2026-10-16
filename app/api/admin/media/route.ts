import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { pageEditorApi } from "@/lib/admin/pageAuth";

// Media library upload for the page builder. Images are resized (max 1600px
// wide) and converted to WebP before storage, so a phone photo of 6MB lands
// as a few hundred KB. Runs as the signed-in user: the site-media bucket and
// site_media table only accept page editors (RLS).

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const auth = await pageEditorApi();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (!alt) return NextResponse.json({ error: "Alt text is required (describe the image)." }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "The image must be under 5MB." }, { status: 413 });
  }

  let out: { data: Buffer; info: { width: number; height: number; size: number } };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return NextResponse.json({ error: "That file is not a readable image." }, { status: 415 });
  }

  const supabase = await createClient();
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage
    .from("site-media")
    .upload(path, out.data, { contentType: "image/webp", cacheControl: "31536000" });
  if (upErr) return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });

  const url = supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  const { data: row, error } = await supabase
    .from("site_media")
    .insert({
      path,
      url,
      alt,
      width: out.info.width,
      height: out.info.height,
      bytes: out.info.size,
      uploaded_by: auth.profile.userId,
    })
    .select("id")
    .single();
  if (error || !row) {
    await supabase.storage.from("site-media").remove([path]);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
  return NextResponse.json({ id: row.id, url, alt, width: out.info.width, height: out.info.height });
}
