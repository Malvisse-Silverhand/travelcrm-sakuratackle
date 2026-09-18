import { createClient } from "@/lib/supabase/server";
import BookingExperience, {
  type Availability,
} from "@/components/public/BookingExperience";
import { BookingProvider } from "@/components/public/BookingState";
import HeroSearch from "@/components/public/HeroSearch";
import FleetSection, { type FleetBoat } from "@/components/public/FleetSection";
import FaqAccordion, { type Faq } from "@/components/public/FaqAccordion";
import {
  CTA_BAND,
  FACILITIES,
  FOOTER,
  GALLERY,
  HERO,
  JETTY,
  NAV,
  STEPS,
  STEPS_NOTE,
  TESTIMONIALS,
} from "@/lib/content/site";
import { MONTHS, currentMonthIdx, isoDate } from "@/lib/season";
import { todayISO } from "@/lib/date";
import styles from "./public.module.css";

/** Group size the page opens on — matches the design's default state. */
const DEFAULT_PAX = 8;

type PackageRow = {
  id: string;
  title: string;
  subtitle: string | null;
  price_per_pax: number;
  deposit_per_boat: number;
  includes: string[];
  faqs: Faq[];
};

type OrgSettings = {
  business_name: string;
  location: string;
  whatsapp_number: string;
};

export default async function Home() {
  const supabase = await createClient();

  // The season spans Mac 2026 → Sep 2027, so index 0 is a month already in the
  // past. Open on the first month that still has sellable nights.
  const openMonthIdx = currentMonthIdx(todayISO());

  const [{ data: pkg }, { data: org }, { data: boats }, { data: availability }] =
    await Promise.all([
      supabase
        .from("packages")
        .select("id,title,subtitle,price_per_pax,deposit_per_boat,includes,faqs")
        .eq("published", true)
        .order("created_at")
        .limit(1)
        .maybeSingle<PackageRow>(),
      supabase
        .from("org_settings")
        .select("business_name,location,whatsapp_number")
        .eq("id", 1)
        .maybeSingle<OrgSettings>(),
      supabase
        .from("boats")
        .select(
          "id,code,display_name,kind,length_ft,beam,material,capacity,daily_rate,description,photo_url"
        )
        .eq("active", true)
        .order("sort_order")
        .order("code")
        .returns<FleetBoat[]>(),
      supabase.rpc("get_public_availability", {
        p_from: isoDate(openMonthIdx, 1),
        p_to: isoDate(openMonthIdx, MONTHS[openMonthIdx].days),
        p_pax: DEFAULT_PAX,
      }),
    ]);

  if (!pkg) {
    return (
      <div className={styles.shell}>
        <main className={styles.heroEmpty}>
          <h1 className={styles.heroTitle}>Trip belum dibuka</h1>
          <p className={styles.heroLead}>
            Tiada pakej trip yang diterbitkan buat masa ini. Sila cuba sebentar lagi atau
            hubungi kami terus.
          </p>
        </main>
      </div>
    );
  }

  const fleet = boats ?? [];
  const waNumber = org?.whatsapp_number ?? "601153598055";
  const waHref = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(
    "Saya berminat trip candat sotong"
  )}`;
  const businessName = org?.business_name ?? "Sakura Tackle";
  const depositLabel = `RM${Number(pkg.deposit_per_boat).toLocaleString("en-MY")}`;

  // Derived from the fleet rather than hardcoded, so deactivating a boat in
  // Settings does not leave the trust strip advertising a boat that is gone.
  const capacities = fleet.map((b) => b.capacity);
  const capacityRange =
    capacities.length > 0
      ? `Kapasiti ${Math.min(...capacities)}–${Math.max(...capacities)} pax`
      : null;

  return (
    <BookingProvider initialPax={DEFAULT_PAX} firstMonthIdx={openMonthIdx}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <a href="#top" className={styles.brand}>
              <span className={styles.logoMark}>CS</span>
              <span className={styles.brandText}>
                <span className={styles.brandName}>Candat Sotong</span>
                <span className={styles.brandSub}>{businessName}</span>
              </span>
            </a>
            <nav className={styles.nav} aria-label="Navigasi utama">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className={styles.navLink}>
                  {n.label}
                </a>
              ))}
            </nav>
            <div className={styles.headerRight}>
              <span className={styles.headerLocation}>
                {org?.location ?? "Jeti Marang, Terengganu"}
              </span>
              <a href="#tempah" className={styles.headerCta}>
                Tempah Slot
              </a>
            </div>
          </div>
        </header>

        <main id="top">
          <section className={styles.heroSection}>
            <div className={styles.container}>
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
                  <span className={styles.heroBadge}>{HERO.eyebrow}</span>
                  <h1 className={styles.heroTitle}>{pkg.title}</h1>
                  {pkg.subtitle && <p className={styles.heroLead}>“{pkg.subtitle}”</p>}
                </div>
              </div>

              <HeroSearch firstMonthIdx={openMonthIdx} />

              <div className={styles.trustStrip}>
                <span>{fleet.length} bot dalam armada</span>
                {capacityRange && <span>{capacityRange}</span>}
                <span>Deposit {depositLabel} untuk lock slot</span>
              </div>
            </div>
          </section>

          <FleetSection boats={fleet} />

          <section className={styles.facilitiesSection}>
            <div className={styles.container}>
              <span className={styles.eyebrow}>Kelengkapan Bot</span>
              <h2 className={styles.sectionTitleSm}>Fasiliti On-Board</h2>
              <p className={styles.sectionLead}>Keselesaan anda, keutamaan kami</p>
              <div className={styles.facilityGrid}>
                {FACILITIES.map((f) => (
                  <div key={f.title} className={styles.facilityCell}>
                    <div className={styles.facilityTitle}>{f.title}</div>
                    <div className={styles.facilityBody}>{f.body}</div>
                  </div>
                ))}
              </div>

              {/* The v2 design has no home for the package's `includes` list,
                  but it is operator-editable in the Packages screen and would
                  otherwise stop appearing anywhere. It sits here because it
                  answers the same question as the facilities above. */}
              {pkg.includes.length > 0 && (
                <div className={styles.includesBlock}>
                  <span className={styles.eyebrow}>Termasuk Dalam Pakej</span>
                  <ul className={styles.includesList}>
                    {pkg.includes.map((item) => (
                      <li key={item} className={styles.includeRow}>
                        <i className={styles.includeTick} aria-hidden="true">
                          ✓
                        </i>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <BookingExperience
            packageId={pkg.id}
            pricePerPax={Number(pkg.price_per_pax)}
            depositPerBoat={Number(pkg.deposit_per_boat)}
            initialAvailability={(availability ?? []) as Availability[]}
          />

          <section id="galeri" className={styles.gallerySection}>
            <div className={styles.container}>
              <span className={styles.eyebrow}>Momento Lubuk Emas</span>
              <h2 className={styles.sectionTitle}>Galeri Tangkapan</h2>
              <div className={styles.masonry}>
                {GALLERY.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={g.src}
                    src={g.src}
                    alt={g.alt}
                    loading="lazy"
                    className={`${styles.masonryImg} ${g.wide ? styles.masonryWide : ""} ${
                      g.tall ? styles.masonryTall : ""
                    }`}
                  />
                ))}
              </div>

              <div className={styles.testimonialBlock}>
                <span className={styles.eyebrow}>Apa Kata Otai Kita?</span>
                <h3 className={styles.sectionTitleSm}>
                  Testimoni pelanggan, seperti yang dihantar
                </h3>
                <p className={styles.sectionLead}>
                  Tangkap skrin perbualan WhatsApp daripada pelanggan trip kami.
                </p>
                <div className={styles.testimonialScroller}>
                  {TESTIMONIALS.map((t) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={t.src}
                      src={t.src}
                      alt={t.alt}
                      loading="lazy"
                      className={styles.testimonialImg}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.stepsSection}>
            <div className={`${styles.container} ${styles.stepsGrid}`}>
              <div>
                <span className={styles.eyebrow}>Perjalanan Sepanjang Trip Candat</span>
                <h2 className={styles.sectionTitle}>
                  Dari jeti ke lubuk, langkah demi langkah
                </h2>
                <div className={styles.stepsNote}>
                  <div className={styles.stepsNoteTitle}>{STEPS_NOTE.title}</div>
                  <p className={styles.stepsNoteBody}>{STEPS_NOTE.body}</p>
                </div>
              </div>
              <ol className={styles.stepList}>
                {STEPS.map((s) => (
                  <li key={s.n} className={styles.stepItem}>
                    <span className={styles.stepNum}>{s.n}</span>
                    <div>
                      <div className={styles.stepTitle}>{s.title}</div>
                      <div className={styles.stepBody}>{s.body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="faq" className={styles.faqSection}>
            <div className={`${styles.container} ${styles.faqGrid}`}>
              <h2 className={styles.sectionTitle}>Soalan lazim</h2>
              <FaqAccordion faqs={pkg.faqs} />
            </div>
          </section>

          <section className={styles.jettySection}>
            <div className={`${styles.container} ${styles.jettyGrid}`}>
              <div>
                <span className={styles.eyebrow}>{JETTY.eyebrow}</span>
                <h2 className={styles.sectionTitle}>{JETTY.title}</h2>
                <p className={styles.sectionLead}>{JETTY.body}</p>
                <div className={styles.jettyAddress}>{JETTY.address}</div>
                <a
                  href={JETTY.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mapsBtn}
                >
                  Buka Google Maps
                </a>
              </div>
              <a
                href={JETTY.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapFrame}
              >
                <span className={styles.mapHint}>
                  Peta Jeti Marang — tekan untuk buka Google Maps
                </span>
              </a>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <div className={styles.container}>
              <div className={styles.ctaBand}>
                <h2 className={styles.ctaTitle}>{CTA_BAND.title}</h2>
                <p className={styles.ctaBody}>{CTA_BAND.body}</p>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.ctaBtn}
                >
                  WhatsApp Kami
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={`${styles.container} ${styles.footerGrid}`}>
            <div>
              <div className={styles.footerBrand}>{businessName}</div>
              <p className={styles.footerBlurb}>{FOOTER.blurb}</p>
            </div>
            <div>
              <div className={styles.footerHeading}>Menu</div>
              <div className={styles.footerLinks}>
                {FOOTER.menu.map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    className={styles.footerLink}
                    {...(m.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {m.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div className={styles.footerHeading}>Hubungi Kami</div>
              <div className={styles.footerLinks}>
                <a href={`tel:+${waNumber}`} className={styles.footerLink}>
                  {formatMyPhone(waNumber)}
                </a>
                <span>{org?.location ?? "Jeti Marang, Terengganu"}</span>
              </div>
            </div>
          </div>
          <div className={`${styles.container} ${styles.footerBase}`}>
            © {new Date().getFullYear()} {businessName}. Hak Cipta Terpelihara. |{" "}
            {org?.location ?? "Jeti Marang, Terengganu"}, Malaysia
          </div>
        </footer>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappFloat}
          aria-label={`WhatsApp ${businessName}`}
        >
          WhatsApp Kami
        </a>
      </div>
    </BookingProvider>
  );
}

/** 601153598055 -> 011-5359 8055, matching the footer copy in the design. */
function formatMyPhone(intl: string): string {
  const digits = intl.replace(/[^0-9]/g, "");
  const local = digits.startsWith("60") ? "0" + digits.slice(2) : digits;
  if (local.length === 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (local.length === 11) {
    return `${local.slice(0, 3)}-${local.slice(3, 7)} ${local.slice(7)}`;
  }
  return local;
}
