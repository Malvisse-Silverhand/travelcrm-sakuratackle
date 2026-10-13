import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import BookingExperience from "@/components/public/BookingExperience";
import { BookingProvider } from "@/components/public/BookingState";
import HeroSearch from "@/components/public/HeroSearch";
import FaqAccordion from "@/components/public/FaqAccordion";
import MobileTabBar from "@/components/public/MobileTabBar";
import BookingNotice from "@/components/public/BookingNotice";
import FloatingWhatsApp from "@/components/public/FloatingWhatsApp";
import FleetShowcase, { type FleetBoat } from "@/components/public/home/FleetShowcase";
import TripTimeline from "@/components/public/home/TripTimeline";
import TestimonialStrip from "@/components/public/home/TestimonialStrip";
import SnapRail from "@/components/public/home/SnapRail";
import FacilityIcon from "@/components/public/home/FacilityIcon";
import { MotionRoot, Reveal, RevealGroup, RevealItem } from "@/components/public/home/Reveal";
import { DEFAULT_PAX, loadBookingData } from "@/lib/booking/publicData";
import {
  CTA_BAND,
  FACILITIES,
  FOOTER,
  GALLERY,
  HERO,
  JETTY,
  NAV,
  SCREENS,
  STEPS,
  STEPS_NOTE,
  TESTIMONIALS,
} from "@/lib/content/site";
import styles from "./public.module.css";
import home from "./home.module.css";

/** Stagger for the hero's CSS entrance, read by `.rise` / `.riseKeep`. */
const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default async function Home() {
  const supabase = await createClient();

  // Package, org and opening-month availability come from the loader the
  // destination guide shares, so both pages tell a database outage apart from
  // an unpublished season the same way. Only the fleet is homepage-specific.
  const [{ openMonthIdx, pkg, org, availability, unavailable }, { data: boats }] =
    await Promise.all([
      loadBookingData(),
      supabase
        .from("boats")
        .select(
          "id,code,display_name,kind,length_ft,beam,material,capacity,daily_rate,description,photo_url"
        )
        .eq("active", true)
        .order("sort_order")
        .order("code")
        .returns<FleetBoat[]>(),
    ]);

  if (!pkg) {
    const wa = org?.whatsapp_number ?? "601153598055";
    return (
      <div className={styles.shell}>
        <BookingNotice
          kind={unavailable ? "down" : "closed"}
          waHref={`https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(
            "Saya berminat trip candat sotong"
          )}`}
        />
      </div>
    );
  }

  const fleet = boats ?? [];
  const waNumber = org?.whatsapp_number ?? "601153598055";
  const waHref = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(
    "Saya berminat trip candat sotong"
  )}`;
  const businessName = org?.business_name ?? "Sakura Tackle";
  const location = org?.location ?? "Jeti Marang, Terengganu";
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
      <MotionRoot>
        <div className={home.page}>
          <div className={home.sky} aria-hidden="true" />

          <header className={styles.header}>
            <div className={styles.headerInner}>
              <a href="#top" className={styles.brand}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-badge.webp" alt="Sakura Tackle" width={34} height={34} className={styles.logoMark} />
                <span className={styles.brandText}>
                  <span className={styles.brandName}>SAKURA TACKLE</span>
                  <span className={styles.brandSub}>Trip Candat Sotong</span>
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
                <a href="#tempah" className={styles.headerCta}>
                  Tempah Slot
                </a>
              </div>
            </div>
          </header>

          <main>
            {/* 1 — Utama */}
            <section
              id="top"
              className={`${styles.heroSection} ${home.screen} ${home.heroScreen}`}
            >
              <div className={styles.container}>
                <div className={`${styles.heroFrame} ${home.heroFill}`}>
                  {/* Frame M1 uses a different shot: the night-fishing photo
                      loses its subject when cropped to phone width. */}
                  <picture>
                    <source media="(max-width: 620px)" srcSet={HERO.photoMobile} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={HERO.photo}
                      alt={HERO.photoAlt}
                      className={`${styles.heroPhoto} ${home.heroDrift}`}
                      fetchPriority="high"
                    />
                  </picture>
                  <div className={styles.heroScrim} />
                  <div className={home.heroGlow} aria-hidden="true" />
                  <div className={styles.heroContent}>
                    <span className={`${styles.heroBadge} ${home.rise}`}>{HERO.eyebrow}</span>
                    <h1 className={`${styles.heroTitle} ${home.riseKeep}`} style={delay(0.08)}>
                      {pkg.title}
                    </h1>
                    {pkg.subtitle && (
                      <p className={`${styles.heroLead} ${home.rise}`} style={delay(0.2)}>
                        “{pkg.subtitle}”
                      </p>
                    )}
                  </div>
                </div>

                <div className={home.rise} style={delay(0.3)}>
                  <HeroSearch firstMonthIdx={openMonthIdx} />
                </div>

                <div className={`${styles.trustStrip} ${home.rise}`} style={delay(0.4)}>
                  <span>{fleet.length} bot dalam armada</span>
                  {capacityRange && <span>{capacityRange}</span>}
                  <span>Deposit {depositLabel} untuk lock slot</span>
                </div>
              </div>
            </section>

            {/* 2 — Tempah: the three-step booking flow */}
            <BookingExperience
              packageId={pkg.id}
              pricePerPax={Number(pkg.price_per_pax)}
              depositPerBoat={Number(pkg.deposit_per_boat)}
              initialPax={DEFAULT_PAX}
              initialAvailability={availability}
              className={`${home.screen} ${home.bookingScreen}`}
            />

            {/* 3 — Armada */}
            <FleetShowcase boats={fleet} />

            {/* 4 — Fasiliti */}
            <section id="fasiliti" className={home.screen}>
              <div className={styles.container}>
                <Reveal>
                  <span className={styles.eyebrow}>Kelengkapan Bot</span>
                  <h2 className={styles.sectionTitle}>Fasiliti On-Board</h2>
                  <p className={styles.sectionLead}>Keselesaan anda, keutamaan kami</p>
                </Reveal>
                <RevealGroup className={home.facGrid}>
                  {FACILITIES.map((f) => (
                    <RevealItem key={f.title}>
                      <div className={home.facCell}>
                        <span className={home.facIcon}>
                          <FacilityIcon name={f.icon} />
                        </span>
                        <div className={home.facTitle}>{f.title}</div>
                        <div className={home.facBody}>{f.body}</div>
                      </div>
                    </RevealItem>
                  ))}
                </RevealGroup>

                {/* The package's `includes` list is operator-editable in the
                    Packages screen and has no other home on the page. It sits
                    here because it answers the same question. */}
                {pkg.includes.length > 0 && (
                  <Reveal className={home.includes}>
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
                  </Reveal>
                )}
              </div>
            </section>

            {/* 5 — Perjalanan */}
            <section id="perjalanan" className={home.screen}>
              <div className={`${styles.container} ${home.tripGrid}`}>
                <Reveal>
                  <span className={styles.eyebrow}>Perjalanan Sepanjang Trip Candat</span>
                  <h2 className={styles.sectionTitle}>Dari jeti ke lubuk, langkah demi langkah</h2>
                  <div className={`${styles.stepsNote} ${home.tripNote}`}>
                    <div className={styles.stepsNoteTitle}>{STEPS_NOTE.title}</div>
                    <p className={styles.stepsNoteBody}>{STEPS_NOTE.body}</p>
                  </div>
                </Reveal>
                <TripTimeline steps={STEPS} />
              </div>
            </section>

            {/* 6 — Galeri */}
            <section id="galeri" className={home.screen}>
              <div className={styles.container}>
                <Reveal>
                  <span className={styles.eyebrow}>Momento Lubuk Emas</span>
                  <h2 className={styles.sectionTitle}>Galeri Tangkapan</h2>
                </Reveal>
                <RevealGroup className={home.bento} stagger={0.06}>
                  {GALLERY.map((g) => (
                    <RevealItem
                      key={g.src}
                      className={`${home.bentoItem} ${g.wide ? home.bentoWide : ""} ${
                        g.tall ? home.bentoTall : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.src} alt={g.alt} loading="lazy" className={home.bentoImg} />
                    </RevealItem>
                  ))}
                </RevealGroup>
              </div>
            </section>

            {/* 7 — Testimoni */}
            <section id="testimoni" className={home.screen}>
              <div className={styles.container}>
                <Reveal>
                  <span className={styles.eyebrow}>Apa Kata Otai Kita?</span>
                  <h2 className={styles.sectionTitle}>Testimoni pelanggan, seperti yang dihantar</h2>
                  <p className={styles.sectionLead}>
                    Tangkap skrin perbualan WhatsApp daripada pelanggan trip kami.
                  </p>
                </Reveal>
                <TestimonialStrip items={TESTIMONIALS} />
              </div>
            </section>

            {/* 8 — FAQ */}
            <section id="faq" className={home.screen}>
              <div className={`${styles.container} ${styles.faqGrid}`}>
                <Reveal>
                  <span className={styles.eyebrow}>Ada soalan?</span>
                  <h2 className={styles.sectionTitle}>Soalan lazim</h2>
                  <p className={`${styles.sectionLead} ${home.faqLead}`}>
                    Tak jumpa jawapan?{" "}
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      Tanya terus di WhatsApp
                    </a>
                    , kami balas 7 hari seminggu.
                  </p>
                </Reveal>
                <FaqAccordion faqs={pkg.faqs} />
              </div>
            </section>

            {/* 9 — Jeti, call to action and footer: dawn, heading home */}
            <div id="jeti" className={`${home.screen} ${home.closing}`}>
              <section className={home.closingBody}>
                <div className={`${styles.container} ${home.closingGrid}`}>
                  <Reveal className={home.jettyCard}>
                    <div>
                      <span className={styles.eyebrow}>{JETTY.eyebrow}</span>
                      <h2 className={styles.sectionTitle}>{JETTY.title}</h2>
                      <p className={styles.sectionLead}>{JETTY.body}</p>
                    </div>
                    <a
                      href={JETTY.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={home.mapArt}
                      aria-label="Buka lokasi Jeti Marang di Google Maps"
                    >
                      <span className={home.mapPin} aria-hidden="true" />
                      <span className={home.mapHint}>Jeti Marang · tekan untuk buka peta</span>
                    </a>
                    <div className={home.jettyActions}>
                      <span className={home.jettyAddress}>{JETTY.address}</span>
                      <a
                        href={JETTY.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mapsBtn}
                      >
                        Buka Google Maps
                      </a>
                    </div>
                  </Reveal>

                  <Reveal className={home.ctaCard} delay={0.1}>
                    <span className={home.ctaSun} aria-hidden="true" />
                    <div data-hides-wa-float>
                      <h2 className={home.ctaTitle}>{CTA_BAND.title}</h2>
                      <p className={home.ctaBody}>{CTA_BAND.body}</p>
                    </div>
                    <a href={waHref} target="_blank" rel="noopener noreferrer" className={home.ctaBtn}>
                      WhatsApp Kami
                    </a>
                  </Reveal>
                </div>
              </section>

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
                          {...(m.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
                      <span>{location}</span>
                    </div>
                  </div>
                </div>
                <div className={`${styles.container} ${styles.footerBase}`}>
                  © {new Date().getFullYear()} {businessName}. Hak Cipta Terpelihara. | {location},
                  Malaysia
                </div>
              </footer>
            </div>
          </main>

          <SnapRail items={SCREENS} />

          <FloatingWhatsApp
            href={waHref}
            label={`WhatsApp ${businessName}`}
            className={home.waFloat}
          />

          <MobileTabBar waHref={waHref} />
        </div>
      </MotionRoot>
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
