/** Public origin of the site, for sitemaps, canonical links and share
 *  previews. Set NEXT_PUBLIC_SITE_URL when a custom domain goes live. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sakuratacklebookingsystem.vercel.app"
).replace(/\/$/, "");
