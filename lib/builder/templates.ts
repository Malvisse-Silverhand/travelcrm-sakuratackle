import type { PageData } from "./config";

// Starting points for a new page in the page builder. Every block gets a
// fresh id (Puck needs one per block).

type Block = { type: string; props: Record<string, unknown> };

const id = (type: string) => `${type}-${crypto.randomUUID()}`;

function block(type: string, props: Record<string, unknown> = {}): Block {
  return { type, props: { id: id(type), ...props } };
}

function section(props: Record<string, unknown>, content: Block[]): Block {
  return block("Section", {
    background: "page",
    image: null,
    padding: "md",
    width: "normal",
    align: "left",
    visibility: "all",
    ...props,
    content,
  });
}

export const TEMPLATES = [
  { key: "blank", label: "Blank page" },
  { key: "campaign", label: "Campaign (hero, benefits, boats, FAQ, WhatsApp)" },
] as const;

export type TemplateKey = (typeof TEMPLATES)[number]["key"];

export function templateData(key: TemplateKey, title: string): PageData {
  if (key === "blank") {
    return {
      root: { props: {} },
      content: [
        section({}, [block("Heading", { eyebrow: "", text: title, level: "h1", size: "xl", align: "left", colour: "ink" })]),
      ],
    } as PageData;
  }

  return {
    root: { props: {} },
    content: [
      section({ background: "ink", padding: "lg", align: "center", width: "narrow" }, [
        block("Badge", { text: "Promo terhad", tone: "gold", align: "center" }),
        block("Spacer", { size: 12 }),
        block("Heading", { eyebrow: "", text: title, level: "h1", size: "xl", align: "center", colour: "white" }),
        block("Spacer", { size: 12 }),
        block("Text", {
          text: "Sewa sebot penuh untuk group anda. Kapten otai bawa ke lubuk sotong terbaik di Terengganu.",
          size: "lg",
          align: "center",
          colour: "white",
        }),
        block("Spacer", { size: 20 }),
        block("Button", {
          label: "Search Available Boats",
          action: "book",
          href: "",
          message: "",
          style: "primary",
          align: "center",
          label2: "",
          href2: "",
        }),
      ]),
      section({ background: "white" }, [
        block("Heading", { eyebrow: "Kenapa kami", text: "Apa yang anda dapat", level: "h2", size: "lg", align: "center", colour: "ink" }),
        block("Spacer", { size: 20 }),
        block("Columns", {
          count: "3",
          middle: false,
          col1: [block("IconBox", { icon: "anchor", title: "Bot penuh", text: "Satu tempahan, satu bot untuk group anda." })],
          col2: [block("IconBox", { icon: "bulb", title: "Lampu candat", text: "Lampu terang untuk tarik sotong naik." })],
          col3: [block("IconBox", { icon: "lifebuoy", title: "Selamat", text: "Jaket keselamatan dan kapten berpengalaman." })],
          col4: [],
        }),
      ]),
      section({}, [
        block("Heading", { eyebrow: "", text: "Pilih bot anda", level: "h2", size: "lg", align: "left", colour: "ink" }),
        block("Spacer", { size: 16 }),
        block("Boats", { pax: 8, limit: 3 }),
      ]),
      section({ background: "white", width: "narrow" }, [
        block("Heading", { eyebrow: "", text: "Soalan lazim", level: "h2", size: "md", align: "left", colour: "ink" }),
        block("Spacer", { size: 12 }),
        block("Faq", {
          items: [
            { q: "Berapa orang satu bot?", a: "Bergantung pada bot, dari 8 hingga 15 orang." },
            { q: "Bila bertolak?", a: "Selepas Asar, pulang lebih kurang 7:00 pagi." },
          ],
        }),
      ]),
      section({}, [
        block("WhatsAppCta", {
          title: "Ada soalan tentang promo ini?",
          text: "WhatsApp kami, kami balas 7 hari seminggu.",
          button: "WhatsApp Us",
          message: `Hai Sakura Tackle! Saya nak tanya tentang ${title}.\n\nSaiz group: ___ orang\nTarikh pilihan: ___`,
        }),
      ]),
    ],
  } as PageData;
}

/** "Promo Merdeka 2027!" -> "promo-merdeka-2027". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
