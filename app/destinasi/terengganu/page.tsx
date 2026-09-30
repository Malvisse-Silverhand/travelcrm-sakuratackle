import type { Metadata } from "next";
import Link from "next/link";
import BookingExperience from "@/components/public/BookingExperience";
import { BookingProvider } from "@/components/public/BookingState";
import FaqAccordion from "@/components/public/FaqAccordion";
import CoastMap from "@/components/public/CoastMap";
import BookingNotice from "@/components/public/BookingNotice";
import FloatingWhatsApp from "@/components/public/FloatingWhatsApp";
import { DEFAULT_PAX, loadBookingData } from "@/lib/booking/publicData";
import { HERO, JETTY } from "@/lib/content/site";
import {
  AREAS,
  HERO_COPY,
  ITINERARY,
  PACKING,
  ROUTE_TIPS,
  SPOTS,
} from "@/lib/content/terengganu";
import pub from "@/app/public.module.css";
import styles from "../destinasi.module.css";

export const metadata: Metadata = {
  title: "Panduan Terengganu: Candat Sotong & Persisiran Pantai | Sakura Tackle",
  description:
    "Peta interaktif persisiran Terengganu: Jeti Marang, Pulau Kapas, Kuala Terengganu, Redang hingga Kemaman. Rancang cuti di sekitar trip candat sotong dan tempah slot terus.",
};

const NAV = [
  { label: "Kawasan", href: "#kawasan" },
  { label: "Peta", href: "#peta" },
  { label: "Itinerari", href: "#itinerari" },
  { label: "Kalendar", href: "#tempah" },
];

export default async function TerengganuGuide() {
  const { openMonthIdx, pkg, org, availability, unavailable } = await loadBookingData();

  const businessName = org?.business_name ?? "Sakura Tackle";
  const waNumber = org?.whatsapp_number ?? "601153598055";
  const waHref = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(
    "Saya berminat trip candat sotong di Terengganu"
  )}`;

  return (
    <div className={pub.shell}>
      <header className={pub.header}>
        <div className={pub.headerInner}>
          <Link href="/" className={pub.brand}>
            <span className={pub.logoMark}>CS</span>
            <span className={pub.brandText}>
              <span className={pub.brandName}>Candat Sotong</span>
              <span className={pub.brandSub}>{businessName}</span>
            </span>
          </Link>
          <nav className={pub.nav} aria-label="Navigasi panduan">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={pub.navLink}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className={pub.headerRight}>
            <a href="#tempah" className={pub.headerCta}>
              Semak Tarikh Kosong
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={pub.container}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/">Utama</Link> <span>/</span> <span>Destinasi</span> <span>/</span>{" "}
              <b>Terengganu</b>
            </nav>
            <div className={styles.heroFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO.photo}
                alt={HERO.photoAlt}
                className={styles.heroPhoto}
                fetchPriority="high"
              />
              <div className={styles.heroScrim} />
              <div className={styles.heroContent}>
                <span className={pub.heroBadge}>{HERO_COPY.eyebrow}</span>
                <h1 className={styles.heroTitle}>{HERO_COPY.title}</h1>
                <p className={styles.heroLead}>{HERO_COPY.lead}</p>
                <div className={styles.heroCtas}>
                  <a href="#peta" className={styles.btnGold}>
                    Buka Peta Interaktif
                  </a>
                  <a href="#tempah" className={styles.btnLight}>
                    Semak Tarikh Kosong
                  </a>
                </div>
              </div>
            </div>
            <div className={styles.facts}>
              <div>
                <b>{AREAS.length}</b>
                <span>kawasan persisiran</span>
              </div>
              <div>
                <b>{SPOTS.length}</b>
                <span>lokasi di peta</span>
              </div>
              <div>
                <b>Lepas Asar</b>
                <span>bertolak dari Jeti Marang</span>
              </div>
              <div>
                <b>7:00 pagi</b>
                <span>pulang keesokannya</span>
              </div>
            </div>
          </div>
        </section>

        <section id="kawasan" className={styles.section}>
          <div className={pub.container}>
            <h2 className={pub.sectionTitle}>Empat kawasan sepanjang pantai</h2>
            <p className={pub.sectionLead}>
              Pilih satu atau dua kawasan ikut masa anda, dan letakkan malam candat di
              tengahnya.
            </p>
            <div className={styles.areaGrid}>
              {AREAS.map((a) => (
                <a key={a.id} href={`#peta-${a.id}`} className={styles.areaCard}>
                  <h3 className={styles.areaName}>{a.name}</h3>
                  <div className={styles.areaPlaces}>{a.places}</div>
                  <p className={styles.areaBody}>{a.body}</p>
                  <span className={styles.areaLink}>Lihat di peta →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="peta" className={`${styles.section} ${styles.sectionTint}`}>
          <div className={pub.container}>
            <span className={pub.eyebrow}>Peta Interaktif</span>
            <h2 className={pub.sectionTitle}>Persisiran pantai Terengganu</h2>
            <p className={pub.sectionLead}>
              Tapis ikut kawasan atau kategori, tekan lokasi untuk butiran, dan susun pelan
              anda. Lubuk sebenar dipilih kapten pada malam trip.
            </p>
            <CoastMap waNumber={waNumber} />
          </div>
        </section>

        <section id="itinerari" className={styles.section}>
          <div className={`${pub.container} ${styles.twoCol}`}>
            <div>
              <h2 className={pub.sectionTitle}>Contoh 2 hari 1 malam</h2>
              <p className={pub.sectionLead}>Satu malam di laut, satu hari di darat.</p>
              <ol className={styles.timeline}>
                {ITINERARY.map((it) => (
                  <li key={it.when} className={styles.timelineItem}>
                    <span className={styles.timelineWhen}>{it.when}</span>
                    <div className={styles.timelineTitle}>{it.title}</div>
                    <p className={styles.timelineBody}>{it.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className={pub.sectionTitleSm}>Tiga keputusan sebelum anda tempah</h2>
              <div className={styles.tipList}>
                {ROUTE_TIPS.map((t, i) => (
                  <div key={t.title} className={styles.tipCard}>
                    <span className={styles.tipNum}>{i + 1}</span>
                    <div>
                      <div className={styles.tipTitle}>{t.title}</div>
                      <p className={styles.tipBody}>{t.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.packCard}>
                <div className={styles.tipTitle}>Senarai bawa</div>
                <ul>
                  {PACKING.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {pkg ? (
          <BookingProvider initialPax={DEFAULT_PAX} firstMonthIdx={openMonthIdx}>
            <div className={styles.bookingIntro}>
              <div className={pub.container}>
                <h2 className={pub.sectionTitle}>{pkg.title}</h2>
                <p className={pub.sectionLead}>
                  Pilih malam, isi butiran group, dan lock slot dengan deposit. Bertolak dari{" "}
                  {JETTY.address}.
                </p>
              </div>
            </div>
            <BookingExperience
              packageId={pkg.id}
              pricePerPax={Number(pkg.price_per_pax)}
              depositPerBoat={Number(pkg.deposit_per_boat)}
              initialPax={DEFAULT_PAX}
              initialAvailability={availability}
            />
          </BookingProvider>
        ) : (
          <BookingNotice kind={unavailable ? "down" : "closed"} waHref={waHref} />
        )}

        {pkg && pkg.faqs.length > 0 && (
          <section id="faq" className={pub.faqSection}>
            <div className={`${pub.container} ${pub.faqGrid}`}>
              <h2 className={pub.sectionTitle}>Soalan lazim</h2>
              <FaqAccordion faqs={pkg.faqs} />
            </div>
          </section>
        )}
      </main>

      <footer className={pub.footer}>
        <div className={`${pub.container} ${pub.footerBase}`}>
          © {new Date().getFullYear()} {businessName}. Hak Cipta Terpelihara. |{" "}
          {org?.location ?? "Jeti Marang, Terengganu"}, Malaysia · Peta ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>
        </div>
      </footer>

      <FloatingWhatsApp href={waHref} label={`WhatsApp ${businessName}`} />
    </div>
  );
}
