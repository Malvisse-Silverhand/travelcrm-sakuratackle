import { createClient } from "@/lib/supabase/server";
import BookingExperience, {
  type Availability,
} from "@/components/public/BookingExperience";
import FaqAccordion, { type Faq } from "@/components/public/FaqAccordion";
import { MONTHS, isoDate } from "@/lib/season";
import styles from "./public.module.css";

const BANNER_SRC = "/images/banner-candat-sotong-2027.png";

/** Group size the calendar opens on — matches the design's default state. */
const DEFAULT_PAX = 10;

type PackageRow = {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
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

  const [{ data: pkg }, { data: org }, { data: availability }] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id,title,subtitle,cover_image_url,price_per_pax,deposit_per_boat,includes,faqs"
      )
      .eq("published", true)
      .order("created_at")
      .limit(1)
      .maybeSingle<PackageRow>(),
    supabase
      .from("org_settings")
      .select("business_name,location,whatsapp_number")
      .eq("id", 1)
      .maybeSingle<OrgSettings>(),
    supabase.rpc("get_public_availability", {
      p_from: isoDate(0, 1),
      p_to: isoDate(0, MONTHS[0].days),
      p_pax: DEFAULT_PAX,
    }),
  ]);

  if (!pkg) {
    return (
      <div className={styles.shell}>
        <main className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>Trip belum dibuka</h1>
            <p className={styles.heroLead}>
              Tiada pakej trip yang diterbitkan buat masa ini. Sila cuba sebentar lagi
              atau hubungi kami terus.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const waNumber = org?.whatsapp_number ?? "60193334821";
  const waHref = `https://wa.me/${waNumber}`;
  const displayPhone = formatMyPhone(waNumber);
  const priceLabel = `RM ${Number(pkg.price_per_pax).toLocaleString("en-MY")}`;
  const depositLabel = `RM ${Number(pkg.deposit_per_boat).toLocaleString("en-MY")}`;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.logoMark}>CS</div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Candat Sotong</span>
              <span className={styles.brandSub}>
                {org?.business_name ?? "Sakura Tackle"}
              </span>
            </div>
          </div>
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

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Trip Candat Paling Best di Terengganu</div>
          <h1 className={styles.heroTitle}>{pkg.title}</h1>
          <p className={styles.heroLead}>{pkg.subtitle}</p>
          <div className={styles.heroActions}>
            <a href="#tempah" className={styles.btnPrimary}>
              Semak Tarikh Kosong
              <span className={styles.btnPrimaryIcon}>&#8599;</span>
            </a>
            <a href="#harga" className={styles.btnGhost}>
              Lihat Harga
            </a>
          </div>
        </div>
        <div className={styles.heroMediaFrame}>
          {pkg.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pkg.cover_image_url}
              alt={pkg.title}
              className={styles.heroMedia}
            />
          ) : (
            <div className={`${styles.heroMedia} ${styles.mediaPlaceholder}`}>
              Foto bot candat waktu senja di Jeti Marang
            </div>
          )}
        </div>
      </section>

      <BookingExperience
        packageId={pkg.id}
        bannerSrc={BANNER_SRC}
        initialAvailability={(availability ?? []) as Availability[]}
      />

      <div className={styles.whatsappWrap}>
        <a href={waHref} className={styles.whatsappFloat} target="_blank" rel="noreferrer">
          WhatsApp Kami
        </a>
      </div>

      <section id="harga" className={styles.pricingSection}>
        <h2 className={styles.sectionTitle}>Harga dan apa yang termasuk</h2>
        <p className={styles.sectionLead}>
          Harga sama untuk semua bot. Yang berbeza cuma kapasiti dan juragan.
        </p>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingMain}>
            <div className={styles.pricingBody}>
              <span className={styles.kicker}>Trip semalaman</span>
              <div className={styles.price}>{priceLabel}</div>
              <div className={styles.priceSub}>seorang, minimum 6 pax</div>
              <div className={styles.includesList}>
                {pkg.includes.map((item) => (
                  <span key={item} className={styles.includeRow}>
                    <i className={styles.includeTick}>&#10003;</i>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className={`${styles.pricingMedia} ${styles.mediaPlaceholder}`}>
              Foto lampu candat waktu malam
            </div>
          </div>
          <div className={styles.pricingSide}>
            <div className={styles.depositCard}>
              <span className={styles.depositKicker}>Deposit</span>
              <div className={styles.depositAmount}>{depositLabel}</div>
              <p className={styles.depositNote}>
                Satu bayaran per bot untuk kunci malam tersebut. Baki dijelaskan di jeti
                sebelum bertolak.
              </p>
            </div>
            <div className={styles.hoursCard}>
              <span className={styles.hoursKicker}>Waktu trip</span>
              <div className={styles.hoursValue}>7.00 malam hingga 6.00 pagi</div>
              <p className={styles.hoursNote}>
                Berkumpul di Jeti Marang pukul 6.30 petang. Trip dibatalkan penuh jika
                cuaca tidak mengizinkan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.faqGrid}>
          <h2 className={styles.faqTitle}>Soalan lazim</h2>
          <FaqAccordion faqs={pkg.faqs} />
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerText}>
            {org?.business_name ?? "Sakura Tackle"}, {org?.location ?? "Jeti Marang, Terengganu"}
          </span>
          <span className={styles.footerText}>{displayPhone}</span>
        </div>
      </footer>
    </div>
  );
}

/** 60193334821 -> 019-333 4821, matching the footer copy in the design. */
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
