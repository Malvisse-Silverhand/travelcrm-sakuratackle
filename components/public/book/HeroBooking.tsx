"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useBooking } from "../BookingState";
import CheckBooking from "../CheckBooking";
import type { FleetBoat } from "../home/FleetShowcase";
import ReceiptUpload from "./ReceiptUpload";
import Icon from "./Icon";
import { PAX_OPTIONS } from "@/lib/season";
import { waBoat, waLink } from "@/lib/whatsapp";
import { ratingText, type RatingSummary } from "@/lib/booking/reviews";
import { BOAT_FEATURES, HERO_BOOKING, jettyLabel, perPax, rm, type Jetty } from "@/lib/content/booking";
import styles from "./book.module.css";

// Leaflet is ~40KB and needs `window`; the card renders its frame first.
const JettyMap = dynamic(() => import("./JettyMap"), {
  ssr: false,
  loading: () => <div className={styles.mapBox} aria-hidden="true" />,
});

type Sort = "fit" | "price" | "cap";

const SORTS: Array<[Sort, string]> = [
  ["fit", "Best fit"],
  ["price", "Lowest price"],
  ["cap", "Largest capacity"],
];

type Props = {
  boats: FleetBoat[];
  /** From the jetties table, in display order. */
  jetties: Jetty[];
  /** Published review ratings, overall and per boat. */
  ratings: RatingSummary;
  depositPerBoat: number;
  subtitle: string | null;
  heroPhoto: string;
  waHref: string;
  /** Operator's WhatsApp, for messages about one boat. */
  waNumber: string;
  /** Class that makes a section one homepage screen. */
  screenClass?: string;
};

/** The above-the-fold booking search, Agoda-style: where and how many, then
 *  the boats that fit, each one a whole-boat charter for the night. Picking a
 *  boat continues to /book. */
export default function HeroBooking({
  boats: allBoats,
  jetties,
  ratings,
  depositPerBoat,
  subtitle,
  heroPhoto,
  waHref,
  waNumber,
  screenClass = "",
}: Props) {
  const { pax, setPax } = useBooking();
  const [tab, setTab] = useState<"search" | "check">("search");
  // Opens on the first open jetty (Marang today).
  const firstOpen = jetties.find((j) => j.open)?.id ?? jetties[0]?.id ?? "";
  const [loc, setLoc] = useState(firstOpen);
  const [focus, setFocus] = useState(firstOpen);
  const [open, setOpen] = useState<"loc" | "pax" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState<Sort>("fit");
  const [scrollTick, setScrollTick] = useState(0);

  const resultsRef = useRef<HTMLElement>(null);

  const location = jetties.find((l) => l.id === loc) ?? jetties[0];
  const openNames = jetties.filter((j) => j.open).map((j) => j.name).join(", ");
  // Only the boats that sail from the jetty picked.
  const boats = allBoats.filter((b) => b.jetty_id === loc);

  // Close a dropdown on Escape or a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-dropdown]")) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // After a search, bring the results into view once they have rendered.
  useEffect(() => {
    if (scrollTick === 0) return;
    resultsRef.current?.scrollIntoView({ block: "start" });
  }, [scrollTick]);

  const pickLoc = (id: string) => {
    const l = jetties.find((x) => x.id === id);
    if (!l) return;
    setFocus(id);
    setOpen(null);
    if (!l.open) {
      setNote(
        `Trip dari ${l.name} akan dibuka tidak lama lagi. Buat masa ini trip bertolak dari ${openNames || "Jeti Marang"}.`
      );
      return;
    }
    setNote(null);
    setLoc(id);
  };

  const search = () => {
    setOpen(null);
    setSearched(true);
    setScrollTick((n) => n + 1);
  };

  const rated = (b: FleetBoat) => (b.daily_rate ?? 0) > 0;
  const fitsRaw = boats.filter((b) => b.capacity >= pax);
  const sorted = [...fitsRaw].sort((a, b) => {
    if (sort === "price") {
      const ra = rated(a) ? Number(a.daily_rate) : Infinity;
      const rb = rated(b) ? Number(b.daily_rate) : Infinity;
      return ra - rb || a.capacity - b.capacity;
    }
    if (sort === "cap") return b.capacity - a.capacity;
    return a.capacity - pax - (b.capacity - pax) || Number(a.daily_rate ?? 0) - Number(b.daily_rate ?? 0);
  });
  const bestCap = fitsRaw.length ? Math.min(...fitsRaw.map((b) => b.capacity)) : 0;
  const others = boats.filter((b) => b.capacity < pax);

  const caps = boats.map((b) => b.capacity);
  const capRange = caps.length ? `Kapasiti ${Math.min(...caps)}–${Math.max(...caps)} pax` : null;

  return (
    <>
      <section id="top" className={`${screenClass} ${styles.heroScreen}`}>
        <div className={styles.heroBand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroPhoto} alt="" className={styles.heroBlur} fetchPriority="high" />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>{HERO_BOOKING.badge}</span>
            <h1 className={styles.heroTitle}>{HERO_BOOKING.title}</h1>
            {subtitle && <p className={styles.heroLead}>“{subtitle}”</p>}
          </div>
        </div>

        <div id="tempah" className={styles.cardWrap} data-hides-wa-float>
          <div className={styles.tabs} role="tablist" aria-label="Booking">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "search"}
              className={`${styles.tab} ${tab === "search" ? styles.tabOn : ""}`}
              onClick={() => setTab("search")}
            >
              <Icon name="fish" size={18} />
              Squid Jigging
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "check"}
              className={`${styles.tab} ${tab === "check" ? styles.tabOn : ""}`}
              onClick={() => setTab("check")}
            >
              <Icon name="receipt" size={18} />
              <span className={styles.tabLong}>Check My Booking</span>
              <span className={styles.tabShort}>My Booking</span>
            </button>
            <Link href="/destinasi/terengganu" className={styles.tab}>
              <Icon name="map" size={18} />
              <span className={styles.tabLong}>Terengganu Map</span>
              <span className={styles.tabShort}>Map</span>
            </Link>
          </div>

          <div className={styles.card}>
            {tab === "search" ? (
              <>
                <div className={styles.cardGrid}>
                  <div className={styles.cardControls}>
                    <div className={styles.dropdown} data-dropdown>
                      <button
                        type="button"
                        className={`${styles.control} ${open === "loc" ? styles.controlOn : ""}`}
                        aria-haspopup="listbox"
                        aria-expanded={open === "loc"}
                        onClick={() => setOpen(open === "loc" ? null : "loc")}
                      >
                        <Icon name="pin" size={26} className={styles.controlIcon} />
                        <span className={styles.controlText}>
                          <span className={styles.controlLabel}>Jetty location</span>
                          <span className={styles.controlValue}>{location?.name}</span>
                          <span className={styles.controlSub}>{location?.subtitle}</span>
                        </span>
                        <Icon name="caret" size={18} className={styles.controlCaret} />
                      </button>
                      {open === "loc" && (
                        <div className={styles.menu} role="listbox" aria-label="Jetty location">
                          {jetties.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              role="option"
                              aria-selected={l.id === loc}
                              className={`${styles.menuItem} ${l.id === loc ? styles.menuItemOn : ""}`}
                              onClick={() => pickLoc(l.id)}
                            >
                              <Icon
                                name="anchor"
                                size={20}
                                className={l.open ? styles.menuIcon : styles.menuIconSoon}
                              />
                              <span className={styles.menuText}>
                                <span className={l.open ? styles.menuName : styles.menuNameSoon}>
                                  {l.name}
                                </span>
                                <span className={styles.menuSub}>{l.open ? l.subtitle : l.subtitle || "Akan dibuka"}</span>
                              </span>
                              {!l.open && <span className={styles.soonPill}>Coming Soon</span>}
                              {l.id === loc && (
                                <Icon name="checkCircle" size={20} className={styles.menuTick} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={styles.dropdown} data-dropdown>
                      <button
                        type="button"
                        className={`${styles.control} ${open === "pax" ? styles.controlOn : ""}`}
                        aria-haspopup="dialog"
                        aria-expanded={open === "pax"}
                        onClick={() => setOpen(open === "pax" ? null : "pax")}
                      >
                        <Icon name="users" size={26} className={styles.controlIcon} />
                        <span className={styles.controlText}>
                          <span className={styles.controlLabel}>Group size</span>
                          <span className={styles.controlValue}>{pax} pax</span>
                          <span className={styles.controlSub}>
                            {fitsRaw.length} bot sesuai untuk group ini
                          </span>
                        </span>
                        <Icon name="caret" size={18} className={styles.controlCaret} />
                      </button>
                      {open === "pax" && (
                        <div className={styles.menuPad} role="dialog" aria-label="Group size">
                          <span className={styles.menuHeading}>Group size</span>
                          <div className={styles.chips}>
                            {PAX_OPTIONS.map((p) => (
                              <button
                                key={p}
                                type="button"
                                aria-pressed={p === pax}
                                className={`${styles.chip} ${p === pax ? styles.chipOn : ""}`}
                                onClick={() => {
                                  setPax(p);
                                  setOpen(null);
                                }}
                              >
                                {p} pax
                              </button>
                            ))}
                          </div>
                          <span className={styles.menuFoot}>
                            Satu tempahan = satu bot penuh untuk group anda.
                          </span>
                        </div>
                      )}
                    </div>

                    {note && (
                      <p role="status" className={styles.noteWarn}>
                        {note}
                      </p>
                    )}

                    <div className={styles.trust}>
                      <span>
                        <Icon name="check" size={15} strokeWidth={2.6} />
                        {boats.length} bot dalam armada
                      </span>
                      {capRange && (
                        <span>
                          <Icon name="check" size={15} strokeWidth={2.6} />
                          {capRange}
                        </span>
                      )}
                      <span>
                        <Icon name="check" size={15} strokeWidth={2.6} />
                        Deposit {rm(depositPerBoat)} untuk lock slot
                      </span>
                      {ratings.overall && (
                        <Link href="/reviews" className={styles.ratingBadge}>
                          <b>★</b>
                          {ratingText(ratings.overall)}
                        </Link>
                      )}
                    </div>
                  </div>

                  <JettyMap jetties={jetties} selected={loc} focus={focus} onPick={pickLoc} />
                </div>

                <div className={styles.searchBtnWrap}>
                  <button type="button" className={styles.searchBtn} onClick={search}>
                    <Icon name="search" size={18} strokeWidth={2.2} />
                    SEARCH AVAILABLE BOATS
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.checkGrid}>
                <div>
                  <h2 className={styles.cardTitle}>Check My Booking</h2>
                  <CheckBooking />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Upload Payment Receipt</h2>
                  <p className={styles.muted}>
                    Dah buat pindahan bank? Masukkan nombor rujukan dan nombor telefon tempahan,
                    kemudian hantar resit.
                  </p>
                  <ReceiptUpload askIdentity />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {searched && tab === "search" && (
        <section
          id="pilih-bot"
          ref={resultsRef}
          className={`${screenClass} ${styles.resultsScreen}`}
          aria-live="polite"
        >
          <div className={styles.results}>
            <div className={styles.resultsHead}>
              <div>
                <h2 className={styles.resultsTitle}>
                  Available boats at {location?.name} for {pax} pax
                </h2>
                <p className={styles.muted}>
                  {sorted.length} bot sesuai. Harga sewa sebot penuh untuk satu malam.
                </p>
              </div>
              <div className={styles.sortBar}>
                <span className={styles.sortLabel}>Sort by</span>
                {SORTS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sort === k}
                    className={`${styles.sortBtn} ${sort === k ? styles.sortBtnOn : ""}`}
                    onClick={() => setSort(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.boatList}>
              {sorted.map((b) => {
                const name = b.display_name ?? b.code;
                const href = `/book?boat=${encodeURIComponent(b.id)}&pax=${pax}`;
                return (
                  <article key={b.id} className={styles.boatRow}>
                    <Link href={href} className={styles.boatPhoto} aria-label={`Select ${name}`}>
                      {b.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.photo_url} alt={`Foto bot ${name}`} loading="lazy" />
                      )}
                    </Link>
                    <div className={styles.boatBody}>
                      <div className={styles.badges}>
                        {b.kind && <span className={styles.kindBadge}>{b.kind}</span>}
                        {b.capacity === bestCap && (
                          <span className={styles.bestBadge}>Best fit for your group</span>
                        )}
                        {ratings.byBoat[b.id] && (
                          <Link href="/reviews" className={styles.ratingBadge}>
                            <b>★</b>
                            {ratingText(ratings.byBoat[b.id])}
                          </Link>
                        )}
                      </div>
                      <h3 className={styles.boatName}>{name}</h3>
                      <span className={styles.boatLoc}>
                        <Icon name="pin" size={15} />
                        {jettyLabel(location)}
                      </span>
                      <dl className={styles.specs}>
                        <Spec label="Length" value={b.length_ft ? `${b.length_ft} Kaki` : "—"} />
                        <Spec label="Beam" value={b.beam ?? "—"} />
                        <Spec label="Capacity" value={`Max ${b.capacity} Pax`} />
                        <Spec label="Material" value={b.material ?? "—"} />
                      </dl>
                      {b.description && <p className={styles.boatDesc}>{b.description}</p>}
                      <div className={styles.features}>
                        {BOAT_FEATURES.map((f) => (
                          <span key={f.label}>
                            <Icon name={f.icon} size={16} />
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.boatPrice}>
                      {rated(b) ? (
                        <>
                          <span className={styles.priceLabel}>per night, whole boat</span>
                          <span className={styles.priceValue}>{rm(Number(b.daily_rate))}</span>
                          <span className={styles.pricePax}>
                            {perPax(Number(b.daily_rate), pax)} untuk {pax} pax
                          </span>
                          <span className={styles.priceNote}>
                            Deposit {rm(depositPerBoat)} untuk lock slot
                          </span>
                          <Link href={href} className={styles.btnPrimary}>
                            Select Boat
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className={styles.priceLabel}>Harga atas permintaan</span>
                          <a
                            href={waLink(waNumber, waBoat({ id: b.id, name }, pax))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.btnGhost}
                          >
                            Ask on WhatsApp
                          </a>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}

              {sorted.length === 0 && (
                <div className={styles.empty}>
                  Tiada bot untuk saiz group ini.{" "}
                  <a href={waHref} target="_blank" rel="noopener noreferrer">
                    WhatsApp kami
                  </a>
                  , kami boleh gabung dua bot untuk group besar.
                </div>
              )}
            </div>

            {others.length > 0 && (
              <div className={styles.others}>
                <h3 className={styles.othersTitle}>Too small for {pax} pax</h3>
                <div className={styles.othersGrid}>
                  {others.map((o) => (
                    <div key={o.id} className={styles.otherItem}>
                      {o.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.photo_url} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.otherPh} />
                      )}
                      <div>
                        <div className={styles.otherName}>{o.display_name ?? o.code}</div>
                        <div className={styles.otherCap}>Max {o.capacity} Pax</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={styles.specLabel}>{label}</dt>
      <dd className={styles.specValue}>{value}</dd>
    </div>
  );
}
