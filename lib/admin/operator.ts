import { createClient } from "@/lib/supabase/server";

export function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "OP";
}

export type OperatorProfile = { userId: string; fullName: string; initials: string };

/** Null when there's no signed-in active operator. The layout already
 *  redirects in that case, so pages under app/admin/* can treat this as
 *  effectively non-null — but still check, since Server Components render
 *  independently of their layout's control flow. */
export async function getOperatorProfile(): Promise<OperatorProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_active) return null;

  return { userId, fullName: profile.full_name, initials: initialsFrom(profile.full_name) };
}
