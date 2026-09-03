import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Only /admin needs a session at all — skip the Supabase round-trip on
  // every public-page request (the booking calendar, FAQ, etc).
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session token if expired. Required for Server Components,
  // which cannot write cookies themselves.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;

  // A Supabase Auth session alone isn't enough — the account also needs an
  // active row in `profiles` (invite-only). "read own profile" RLS lets the
  // signed-in user check exactly this, nothing more.
  let isOperator = false;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();
    isOperator = !!profile?.is_active;
  }

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === LOGIN_PATH;

  if (isAdminRoute && !isLoginRoute && !isOperator) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && isOperator) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}
