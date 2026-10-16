import "server-only";

import { NextResponse } from "next/server";
import { getOperatorProfile, type OperatorProfile } from "@/lib/admin/operator";

/** For page-builder API routes: admins and editors only. Vendors and
 *  signed-out callers get an error response instead of a redirect. RLS
 *  (private.is_page_editor) enforces the same rule on every query. */
export async function pageEditorApi(): Promise<
  { ok: true; profile: OperatorProfile } | { ok: false; response: NextResponse }
> {
  const profile = await getOperatorProfile();
  if (!profile) return { ok: false, response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  if (profile.role === "vendor") {
    return { ok: false, response: NextResponse.json({ error: "Admins and editors only." }, { status: 403 }) };
  }
  return { ok: true, profile };
}
