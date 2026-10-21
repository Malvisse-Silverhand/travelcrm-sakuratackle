import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import { HERO } from "@/lib/content/site";
import { Poppins, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import WhatsAppOptIn from "@/components/public/WhatsAppOptIn";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Trip candat sotong semalaman di Marang, Terengganu. Tak perlu skil tinggi, janji ada hati. Semak tarikh kosong dan tempah slot anda.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SAKURA TACKLE | Trip Candat Sotong Otai-Otai",
  description: DESCRIPTION,
  // What WhatsApp, Facebook and Telegram show when the link is shared.
  openGraph: {
    type: "website",
    locale: "ms_MY",
    siteName: "SAKURA TACKLE",
    title: "Trip Candat Sotong Otai-Otai | SAKURA TACKLE",
    description: DESCRIPTION,
    images: [{ url: HERO.photo, alt: HERO.photoAlt }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ms" className={`${poppins.variable} ${inter.variable}`}>
      <body>
        {children}
        <WhatsAppOptIn />
        <Analytics />
      </body>
    </html>
  );
}
