import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses RLS entirely, so it is only ever used from
 *  route handlers that have already proved the caller owns the record they
 *  are touching — never from a Server Component that merely renders a page.
 *
 *  The `server-only` import above makes importing this from a client
 *  component a build error rather than a runtime key leak.
 *
 *  No session is persisted: this client represents the service, not a user,
 *  and a persisted session would leak between requests on a warm function. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
