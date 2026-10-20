import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { sheetCsvUrl } from "@/lib/import/sheet";

// Fetch a Google Sheet as CSV for the import wizard. Works for sheets shared
// as "Anyone with the link"; no Google sign-in is involved. Only
// docs.google.com spreadsheet links are fetched.

const MAX_BYTES = 3_000_000;

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const csvUrl = sheetCsvUrl(String(body.url ?? "").trim());
  if (!csvUrl) {
    return NextResponse.json({ error: "Paste a Google Sheets link (docs.google.com/spreadsheets/…)." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(csvUrl, { redirect: "follow", cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheets. Try again." }, { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("csv")) {
    return NextResponse.json(
      { error: 'The sheet is not open to the link. In Google Sheets: Share → General access → "Anyone with the link" (Viewer), then try again.' },
      { status: 400 }
    );
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) {
    return NextResponse.json({ error: "That sheet is too big (over 3 MB). Split it, or import one tab at a time." }, { status: 413 });
  }
  return NextResponse.json({ csv: text });
}
