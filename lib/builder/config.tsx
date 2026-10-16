import type { ReactNode } from "react";
import Link from "next/link";
import type { ComponentConfig, Config, Data, Slot } from "@puckeditor/core";
import Icon, { ICON_NAMES } from "@/components/public/book/Icon";
import { waLink, DEFAULT_WA } from "@/lib/whatsapp";
import BoatCards from "./BoatCards";
import VendorSignupForm from "./VendorSignupForm";
import MediaField, { type MediaValue } from "./MediaField";
import styles from "./blocks.module.css";

// The page builder's blocks (PB1). One config serves the editor (Puck, in
// /admin/pages/[id]) and the public renderer (app/[slug]/page.tsx), so what
// the editor shows is what visitors get. Only brand colours are offered, and
// every block lays out with container queries (980 / 620).
//
// Render metadata (passed by both sides): { pageUrl, waNumber }.

type Meta = { pageUrl?: string; waNumber?: string };

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

const ALIGN = [
  { label: "Left", value: "left" },
  { label: "Centre", value: "center" },
  { label: "Right", value: "right" },
];
const alignClass = (a: string) => (a === "center" ? styles.alignCenter : a === "right" ? styles.alignRight : "");

const TEXT_COLOURS = [
  { label: "Ink", value: "ink" },
  { label: "Muted", value: "muted" },
  { label: "Purple", value: "purple" },
  { label: "Gold", value: "gold" },
  { label: "White (on dark)", value: "white" },
];
const colourClass: Record<string, string> = {
  ink: styles.cInk,
  muted: styles.cMuted,
  purple: styles.cPurple,
  gold: styles.cGold,
  white: styles.cWhite,
};

const mediaField = {
  type: "custom" as const,
  label: "Image",
  render: ({ value, onChange }: { value: MediaValue; onChange: (v: MediaValue) => void }) => (
    <MediaField value={value} onChange={onChange} />
  ),
};

// ------------------------------------------------------------------ layout

type SectionProps = {
  background: string;
  image: MediaValue;
  padding: string;
  width: string;
  align: string;
  visibility: string;
  content: Slot;
};

const Section: ComponentConfig<SectionProps> = {
  label: "Section",
  fields: {
    background: {
      type: "select",
      label: "Background",
      options: [
        { label: "Page (lavender)", value: "page" },
        { label: "White", value: "white" },
        { label: "Soft purple", value: "tint" },
        { label: "Soft gold", value: "gold" },
        { label: "Purple", value: "purple" },
        { label: "Night (dark)", value: "ink" },
        { label: "Photo", value: "image" },
      ],
    },
    image: { ...mediaField, label: "Background photo (when Photo)" },
    padding: {
      type: "radio",
      label: "Spacing",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
    width: {
      type: "radio",
      label: "Content width",
      options: [
        { label: "Narrow", value: "narrow" },
        { label: "Normal", value: "normal" },
        { label: "Full", value: "full" },
      ],
    },
    align: { type: "radio", label: "Text align", options: ALIGN },
    visibility: {
      type: "select",
      label: "Show on",
      options: [
        { label: "All devices", value: "all" },
        { label: "Desktop and tablet only", value: "desktop" },
        { label: "Phone only", value: "phone" },
      ],
    },
    content: { type: "slot" },
  },
  defaultProps: {
    background: "page",
    image: null,
    padding: "md",
    width: "normal",
    align: "left",
    visibility: "all",
    content: [],
  },
  render: ({ background, image, padding, width, align, visibility, content: Content }) => {
    const bg =
      {
        page: styles.bgPage,
        white: styles.bgWhite,
        tint: styles.bgTint,
        gold: styles.bgGold,
        purple: styles.bgPurple,
        ink: styles.bgInk,
        image: styles.bgInk,
      }[background] ?? styles.bgPage;
    const photo = background === "image" && image?.url;
    return (
      <section
        className={cx(
          styles.section,
          bg,
          visibility === "desktop" && styles.hidePhone,
          visibility === "phone" && styles.hideDesktop
        )}
        style={photo ? { backgroundImage: `url("${image.url}")`, color: "#fff" } : undefined}
      >
        {photo && <div className={styles.shade} aria-hidden="true" />}
        <Content
          className={cx(
            styles.sectionInner,
            { narrow: styles.wNarrow, normal: styles.wNormal, full: styles.wFull }[width],
            { sm: styles.padSm, md: styles.padMd, lg: styles.padLg }[padding],
            alignClass(align)
          )}
        />
      </section>
    );
  },
};

type ColumnsProps = {
  count: string;
  middle: boolean;
  col1: Slot;
  col2: Slot;
  col3: Slot;
  col4: Slot;
};

const Columns: ComponentConfig<ColumnsProps> = {
  label: "Columns",
  fields: {
    count: {
      type: "radio",
      label: "Columns (stack on phones)",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    middle: {
      type: "radio",
      label: "Vertical align",
      options: [
        { label: "Top", value: false },
        { label: "Middle", value: true },
      ],
    },
    col1: { type: "slot" },
    col2: { type: "slot" },
    col3: { type: "slot" },
    col4: { type: "slot" },
  },
  defaultProps: { count: "2", middle: false, col1: [], col2: [], col3: [], col4: [] },
  render: ({ count, middle, col1: C1, col2: C2, col3: C3, col4: C4 }) => {
    const n = Number(count) || 2;
    const cols = [C1, C2, C3, C4].slice(0, n);
    return (
      <div className={cx(styles.columns, { 2: styles.cols2, 3: styles.cols3, 4: styles.cols4 }[n], middle && styles.alignMiddle)}>
        {cols.map((C, i) => (
          <C key={i} className={styles.col} />
        ))}
      </div>
    );
  },
};

const Spacer: ComponentConfig<{ size: number }> = {
  label: "Spacer",
  fields: { size: { type: "number", label: "Height (px)", min: 4, max: 200, step: 4 } },
  defaultProps: { size: 32 },
  render: ({ size }) => <span className={styles.spacer} style={{ height: size }} aria-hidden="true" />,
};

const Divider: ComponentConfig = {
  label: "Divider",
  fields: {},
  render: () => <hr className={styles.divider} />,
};

// ------------------------------------------------------------------- basic

type HeadingProps = { eyebrow: string; text: string; level: string; size: string; align: string; colour: string };

const Heading: ComponentConfig<HeadingProps> = {
  label: "Heading",
  fields: {
    eyebrow: { type: "text", label: "Small label above (optional)" },
    text: { type: "textarea", label: "Heading", contentEditable: true },
    level: {
      type: "radio",
      label: "Level (one H1 per page)",
      options: [
        { label: "H1", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
      ],
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "XL", value: "xl" },
        { label: "L", value: "lg" },
        { label: "M", value: "md" },
        { label: "S", value: "sm" },
      ],
    },
    align: { type: "radio", label: "Align", options: ALIGN },
    colour: { type: "select", label: "Colour", options: TEXT_COLOURS },
  },
  defaultProps: { eyebrow: "", text: "Your heading", level: "h2", size: "lg", align: "left", colour: "ink" },
  render: ({ eyebrow, text, level, size, align, colour }) => {
    const Tag = (["h1", "h2", "h3"].includes(level) ? level : "h2") as "h1" | "h2" | "h3";
    return (
      <div className={alignClass(align)}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <Tag
          className={cx(
            styles.heading,
            { xl: styles.hXl, lg: styles.hLg, md: styles.hMd, sm: styles.hSm }[size],
            colourClass[colour]
          )}
        >
          {text}
        </Tag>
      </div>
    );
  },
};

type TextProps = { text: string; size: string; align: string; colour: string };

const Text: ComponentConfig<TextProps> = {
  label: "Text",
  fields: {
    text: { type: "textarea", label: "Text", contentEditable: true },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
    align: { type: "radio", label: "Align", options: ALIGN },
    colour: { type: "select", label: "Colour", options: TEXT_COLOURS },
  },
  defaultProps: { text: "Tulis teks di sini.", size: "md", align: "left", colour: "muted" },
  render: ({ text, size, align, colour }) => (
    <p className={cx(styles.text, { sm: styles.tSm, md: styles.tMd, lg: styles.tLg }[size], alignClass(align), colourClass[colour])}>
      {text}
    </p>
  ),
};

const RichText: ComponentConfig<{ content: string }> = {
  label: "Rich Text",
  fields: {
    content: {
      type: "richtext",
      label: "Content",
      contentEditable: true,
    },
  },
  defaultProps: { content: "<p>Teks dengan <strong>bold</strong>, <em>italic</em>, senarai dan pautan.</p>" },
  // Puck renders the stored HTML; it is sanitised on publish (lib/builder/sanitize.ts).
  render: ({ content }) => <div className={styles.rich}>{content}</div>,
};

type ButtonProps = {
  label: string;
  action: string;
  href: string;
  message: string;
  style: string;
  align: string;
  label2: string;
  href2: string;
};

const BUTTON_STYLES = [
  { label: "Gold (main)", value: "primary" },
  { label: "White", value: "secondary" },
  { label: "Purple", value: "dark" },
  { label: "WhatsApp green", value: "whatsapp" },
];
const btnClass: Record<string, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  dark: styles.btnDark,
  whatsapp: styles.btnWhatsapp,
};

const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: { type: "text", label: "Label" },
    action: {
      type: "select",
      label: "Opens",
      options: [
        { label: "A link", value: "link" },
        { label: "Booking search (homepage)", value: "book" },
        { label: "WhatsApp with a message", value: "whatsapp" },
      ],
    },
    href: { type: "text", label: "Link (when A link), e.g. /reviews or https://…" },
    message: { type: "textarea", label: "WhatsApp message (when WhatsApp)" },
    style: { type: "select", label: "Style", options: BUTTON_STYLES },
    align: { type: "radio", label: "Align", options: ALIGN },
    label2: { type: "text", label: "Second button label (optional)" },
    href2: { type: "text", label: "Second button link" },
  },
  defaultProps: {
    label: "Book a Boat",
    action: "book",
    href: "",
    message: "Hai Sakura Tackle! Saya berminat dengan trip candat sotong.",
    style: "primary",
    align: "left",
    label2: "",
    href2: "",
  },
  render: ({ label, action, href, message, style, align, label2, href2, puck }) => {
    const meta = (puck?.metadata ?? {}) as Meta;
    const url =
      action === "book"
        ? "/#tempah"
        : action === "whatsapp"
          ? waLink(meta.waNumber ?? DEFAULT_WA, `${message}${meta.pageUrl ? `\n\nDari: ${meta.pageUrl}` : ""}`)
          : safeHref(href);
    const external = /^https?:\/\//.test(url);
    return (
      <div className={cx(styles.btnRow, align === "center" && styles.btnRowCenter, align === "right" && styles.btnRowRight)}>
        <a
          href={url}
          className={cx(styles.btn, btnClass[style] ?? styles.btnPrimary)}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {action === "whatsapp" && <Icon name="whatsapp" size={18} />}
          {label}
        </a>
        {label2 && (
          <a href={safeHref(href2)} className={cx(styles.btn, styles.btnSecondary)}>
            {label2}
          </a>
        )}
      </div>
    );
  },
};

/** Only site paths, https, mailto and tel links; anything else becomes "#". */
function safeHref(href: string): string {
  const h = (href ?? "").trim();
  if (/^(\/|#|https:\/\/|mailto:|tel:)/i.test(h)) return h;
  return "#";
}

type ImageProps = { image: MediaValue; caption: string; rounded: boolean; maxWidth: number };

const ImageBlock: ComponentConfig<ImageProps> = {
  label: "Image",
  fields: {
    image: mediaField,
    caption: { type: "text", label: "Caption (optional)" },
    rounded: {
      type: "radio",
      label: "Corners",
      options: [
        { label: "Rounded", value: true },
        { label: "Square", value: false },
      ],
    },
    maxWidth: { type: "number", label: "Max width (px, 0 = full)", min: 0, max: 1600, step: 20 },
  },
  defaultProps: { image: null, caption: "", rounded: true, maxWidth: 0 },
  render: ({ image, caption, rounded, maxWidth }) =>
    image?.url ? (
      <figure className={styles.figure} style={maxWidth ? { maxWidth, marginInline: "auto" } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          className={cx(styles.img, rounded && styles.rounded)}
        />
        {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      </figure>
    ) : (
      <div className={styles.imgPlaceholder}>Choose an image in the settings panel</div>
    ),
};

/** YouTube (watch, youtu.be, shorts) or a direct https .mp4. */
function videoEmbed(url: string): { kind: "youtube" | "mp4"; src: string } | null {
  const u = (url ?? "").trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  if (/^https:\/\/\S+\.mp4(\?\S*)?$/i.test(u)) return { kind: "mp4", src: u };
  return null;
}

const Video: ComponentConfig<{ url: string; title: string }> = {
  label: "Video",
  fields: {
    url: { type: "text", label: "YouTube link or https .mp4" },
    title: { type: "text", label: "Title (for screen readers)" },
  },
  defaultProps: { url: "", title: "Video" },
  render: ({ url, title }) => {
    const v = videoEmbed(url);
    if (!v) return <div className={styles.imgPlaceholder}>Paste a YouTube link in the settings panel</div>;
    return (
      <div className={styles.video}>
        {v.kind === "youtube" ? (
          <iframe
            src={v.src}
            title={title}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={v.src} controls preload="metadata" playsInline title={title} />
        )}
      </div>
    );
  },
};

const ICON_OPTIONS = ICON_NAMES.map((n) => ({ label: n, value: n }));

const IconBlock: ComponentConfig<{ name: string; size: number; colour: string; align: string }> = {
  label: "Icon",
  fields: {
    name: { type: "select", label: "Icon", options: ICON_OPTIONS },
    size: { type: "number", label: "Size (px)", min: 16, max: 96, step: 4 },
    colour: { type: "select", label: "Colour", options: TEXT_COLOURS },
    align: { type: "radio", label: "Align", options: ALIGN },
  },
  defaultProps: { name: "fish", size: 40, colour: "purple", align: "left" },
  render: ({ name, size, colour, align }) => (
    <div className={alignClass(align)}>
      <span className={cx(styles.iconWrap, colourClass[colour])}>
        <Icon name={name} size={size} />
      </span>
    </div>
  ),
};

// ------------------------------------------------------------------ blocks

const IconBox: ComponentConfig<{ icon: string; title: string; text: string }> = {
  label: "Icon Box",
  fields: {
    icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
    title: { type: "text", label: "Title" },
    text: { type: "textarea", label: "Text" },
  },
  defaultProps: { icon: "lifebuoy", title: "Safety Gear", text: "Jaket keselamatan untuk semua." },
  render: ({ icon, title, text }) => (
    <div className={styles.iconBox}>
      <span className={styles.iconBoxIcon}>
        <Icon name={icon} size={24} />
      </span>
      <h3 className={styles.iconBoxTitle}>{title}</h3>
      {text && <p className={styles.iconBoxText}>{text}</p>}
    </div>
  ),
};

const CheckList: ComponentConfig<{ items: Array<{ text: string }> }> = {
  label: "Checkmark List",
  fields: {
    items: {
      type: "array",
      label: "Items",
      arrayFields: { text: { type: "text", label: "Item" } },
      defaultItemProps: { text: "New item" },
      getItemSummary: (item) => item.text || "Item",
    },
  },
  defaultProps: {
    items: [{ text: "Bot penuh untuk group anda" }, { text: "Makan malam disediakan" }, { text: "Lampu candat & GPS" }],
  },
  render: ({ items }) => (
    <ul className={styles.checkList}>
      {items.map((it, i) => (
        <li key={i}>
          <Icon name="check" size={18} strokeWidth={2.6} />
          {it.text}
        </li>
      ))}
    </ul>
  ),
};

const Faq: ComponentConfig<{ items: Array<{ q: string; a: string }> }> = {
  label: "FAQ",
  fields: {
    items: {
      type: "array",
      label: "Questions",
      arrayFields: {
        q: { type: "text", label: "Question" },
        a: { type: "textarea", label: "Answer" },
      },
      defaultItemProps: { q: "Soalan baru?", a: "Jawapan." },
      getItemSummary: (item) => item.q || "Question",
    },
  },
  defaultProps: {
    items: [
      { q: "Berapa orang satu bot?", a: "Bergantung pada bot, dari 8 hingga 15 orang." },
      { q: "Perlu bawa apa?", a: "Ubat mabuk laut, baju sejuk dan plastik untuk sotong." },
    ],
  },
  // Native <details>: works without JavaScript and is fully accessible.
  render: ({ items }) => (
    <div className={styles.faq}>
      {items.map((it, i) => (
        <details key={i} className={styles.faqItem}>
          <summary>{it.q}</summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  ),
};

const Testimonial: ComponentConfig<{ quote: string; name: string; detail: string; rating: number }> = {
  label: "Testimonial",
  fields: {
    quote: { type: "textarea", label: "Quote" },
    name: { type: "text", label: "Name" },
    detail: { type: "text", label: "Detail (e.g. trip date, group)" },
    rating: { type: "number", label: "Stars (0 hides)", min: 0, max: 5, step: 1 },
  },
  defaultProps: { quote: "Sotong banyak, kapten otai!", name: "Pelanggan", detail: "Group 10 orang", rating: 5 },
  render: ({ quote, name, detail, rating }) => (
    <figure className={styles.testimonial}>
      {rating > 0 && (
        <span className={styles.stars} aria-label={`${rating} of 5`}>
          {"★".repeat(Math.min(5, rating))}
        </span>
      )}
      <blockquote className={styles.quote}>“{quote}”</blockquote>
      <figcaption className={styles.who}>
        <b>{name}</b>
        {detail ? ` · ${detail}` : ""}
      </figcaption>
    </figure>
  ),
};

const Badge: ComponentConfig<{ text: string; tone: string; align: string }> = {
  label: "Badge",
  fields: {
    text: { type: "text", label: "Text" },
    tone: {
      type: "radio",
      label: "Colour",
      options: [
        { label: "Gold", value: "gold" },
        { label: "Purple", value: "purple" },
        { label: "Green", value: "green" },
      ],
    },
    align: { type: "radio", label: "Align", options: ALIGN },
  },
  defaultProps: { text: "Promo terhad", tone: "gold", align: "left" },
  render: ({ text, tone, align }) => (
    <div className={alignClass(align)}>
      <span className={cx(styles.badge, { gold: styles.badgeGold, purple: styles.badgePurple, green: styles.badgeGreen }[tone])}>
        {text}
      </span>
    </div>
  ),
};

// ----------------------------------------------------------- Sakura blocks

type CtaProps = { title: string; text: string; button: string; theme: string };

const BookNow: ComponentConfig<CtaProps> = {
  label: "Book Now banner",
  fields: {
    title: { type: "text", label: "Title" },
    text: { type: "textarea", label: "Text" },
    button: { type: "text", label: "Button label" },
    theme: {
      type: "radio",
      label: "Look",
      options: [
        { label: "Night", value: "dark" },
        { label: "Light", value: "light" },
      ],
    },
  },
  defaultProps: {
    title: "Dah sedia nak candat?",
    text: "Pilih bot, pilih tarikh, lock slot dengan deposit.",
    button: "Search Available Boats",
    theme: "dark",
  },
  render: ({ title, text, button, theme }) => (
    <div className={cx(styles.cta, theme === "light" && styles.ctaLight)}>
      <div>
        <h3 className={styles.ctaTitle}>{title}</h3>
        {text && <p className={styles.ctaText}>{text}</p>}
      </div>
      <Link href="/#tempah" className={cx(styles.btn, styles.btnPrimary)}>
        <Icon name="search" size={18} />
        {button}
      </Link>
    </div>
  ),
};

const WhatsAppCta: ComponentConfig<{ title: string; text: string; button: string; message: string }> = {
  label: "WhatsApp banner",
  fields: {
    title: { type: "text", label: "Title" },
    text: { type: "textarea", label: "Text" },
    button: { type: "text", label: "Button label" },
    message: { type: "textarea", label: "Pre-filled WhatsApp message (the page link is added)" },
  },
  defaultProps: {
    title: "Ada soalan?",
    text: "WhatsApp kami, kami balas 7 hari seminggu.",
    button: "WhatsApp Us",
    message: "Hai Sakura Tackle! Saya nak tanya tentang promo ini.\n\nSaiz group: ___ orang\nTarikh pilihan: ___",
  },
  render: ({ title, text, button, message, puck }) => {
    const meta = (puck?.metadata ?? {}) as Meta;
    const href = waLink(meta.waNumber ?? DEFAULT_WA, `${message}${meta.pageUrl ? `\n\nDari: ${meta.pageUrl}` : ""}`);
    return (
      <div className={cx(styles.cta, styles.ctaLight)}>
        <div>
          <h3 className={styles.ctaTitle}>{title}</h3>
          {text && <p className={styles.ctaText}>{text}</p>}
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" className={cx(styles.btn, styles.btnWhatsapp)}>
          <Icon name="whatsapp" size={18} />
          {button}
        </a>
      </div>
    );
  },
};

const Boats: ComponentConfig<{ pax: number; limit: number }> = {
  label: "Boat cards (live)",
  fields: {
    pax: { type: "number", label: "Group size the boats must fit", min: 1, max: 15, step: 1 },
    limit: { type: "number", label: "How many (0 = all)", min: 0, max: 12, step: 1 },
  },
  defaultProps: { pax: 8, limit: 3 },
  render: ({ pax, limit }) => <BoatCards pax={pax || 8} limit={limit} />,
};

const VendorSignup: ComponentConfig<{ title: string; text: string; button: string; success: string }> = {
  label: "Vendor signup form",
  fields: {
    title: { type: "text", label: "Title" },
    text: { type: "textarea", label: "Text" },
    button: { type: "text", label: "Button label" },
    success: { type: "textarea", label: "Message after sending" },
  },
  defaultProps: {
    title: "Daftar sebagai vendor",
    text: "Isi borang ni, team kami akan WhatsApp anda dalam 2 hari bekerja.",
    button: "Hantar permohonan",
    success: "Permohonan anda dah sampai. Team kami akan WhatsApp anda dalam 2 hari bekerja.",
  },
  // The fields themselves are fixed; applications appear in Admin → Vendor applications.
  render: ({ title, text, button, success, puck }) => {
    const meta = (puck?.metadata ?? {}) as Meta;
    const source = meta.pageUrl?.split("/").filter(Boolean).pop();
    return (
      <VendorSignupForm
        title={title}
        text={text}
        button={button}
        success={success}
        editing={puck?.isEditing}
        source={source}
      />
    );
  },
};

// ------------------------------------------------------------------ config

/** A page's content as Puck 1it ({ root, content, zones }). */
export type PageData = Data;

export const builderConfig: Config = {
  categories: {
    layout: { title: "Layout", components: ["Section", "Columns", "Spacer", "Divider"] },
    basic: { title: "Basic", components: ["Heading", "Text", "RichText", "Button", "Image", "Video", "Icon"] },
    blocks: { title: "Blocks", components: ["IconBox", "CheckList", "Faq", "Testimonial", "Badge"] },
    sakura: { title: "Sakura", components: ["BookNow", "WhatsAppCta", "Boats", "VendorSignup"] },
  },
  components: {
    Section,
    Columns,
    Spacer,
    Divider,
    Heading,
    Text,
    RichText,
    Button,
    Image: ImageBlock,
    Video,
    Icon: IconBlock,
    IconBox,
    CheckList,
    Faq,
    Testimonial,
    Badge,
    BookNow,
    WhatsAppCta,
    Boats,
    VendorSignup,
  } as Config["components"],
  root: {
    // Title, address and SEO live in Page settings, not here.
    fields: {},
    render: ({ children }: { children: ReactNode }) => <div className={styles.page}>{children}</div>,
  },
};
