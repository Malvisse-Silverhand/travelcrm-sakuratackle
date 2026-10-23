import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { OLD_HOST, SITE_URL } from "@/lib/site-url";

export function proxy(request: NextRequest) {
  // The site moved to sakuratackle.com: links already shared on the old
  // vercel.app address land on the same page there. API routes are left
  // alone so a request in flight (or a cron) is not bounced. Preview
  // deployments have their own hosts and are unaffected.
  if (request.headers.get("host") === OLD_HOST && !request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.redirect(`${SITE_URL}${request.nextUrl.pathname}${request.nextUrl.search}`, 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
