/** Public origin of the site, for sitemaps, canonical links, emails,
 *  receipts and share previews. sakuratackle.com went live on 23 Oct 2026;
 *  NEXT_PUBLIC_SITE_URL overrides it (e.g. for a staging domain). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sakuratackle.com").replace(/\/$/, "");

/** The old production address; visitors on it are sent to SITE_URL. */
export const OLD_HOST = "sakuratacklebookingsystem.vercel.app";
