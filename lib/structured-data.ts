import { SITE_URL } from "@/lib/site-url";
import { HERO, JETTY } from "@/lib/content/site";
import type { Faq } from "@/components/public/FaqAccordion";

/** schema.org data for the homepage, so Google can show the business, the
 *  trip's price range and the FAQ as rich results. Built from the same rows
 *  the page renders, so it never advertises a boat or price that is gone. */
export function homeJsonLd({
  businessName,
  phone,
  tripTitle,
  description,
  rates,
  faqs,
}: {
  businessName: string;
  phone: string;
  tripTitle: string;
  description: string;
  rates: number[];
  faqs: Faq[];
}) {
  const business = {
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: businessName,
    url: SITE_URL,
    image: HERO.photo,
    logo: `${SITE_URL}/brand/sakura-tackle-logo.png`,
    telephone: `+${phone.replace(/[^0-9]/g, "")}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: JETTY.address,
      addressLocality: "Marang",
      addressRegion: "Terengganu",
      postalCode: "21600",
      addressCountry: "MY",
    },
    geo: { "@type": "GeoCoordinates", latitude: 5.2066, longitude: 103.2058 },
    hasMap: JETTY.mapsUrl,
  };

  const graph: object[] = [business];

  if (rates.length > 0) {
    graph.push({
      "@type": "TouristTrip",
      name: tripTitle,
      description,
      touristType: "Squid jigging",
      provider: { "@id": `${SITE_URL}/#business` },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "MYR",
        lowPrice: Math.min(...rates),
        highPrice: Math.max(...rates),
        offerCount: rates.length,
        url: `${SITE_URL}/#tempah`,
      },
    });
  }

  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Safe to inline in a <script>: "<" cannot close the tag. */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\u003c");
}
