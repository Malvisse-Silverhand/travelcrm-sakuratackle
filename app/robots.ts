import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The operator console, the API, checkout pages (one per boat and
      // group size) and the 3D review page are not for search results.
      disallow: ["/admin", "/api/", "/book", "/preview/", "/my-booking", "/resit"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
