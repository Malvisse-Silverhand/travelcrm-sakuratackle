import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/destinasi/terengganu`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/polisi`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
