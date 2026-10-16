import "server-only";

import sanitizeHtml from "sanitize-html";
import { builderConfig, type PageData } from "./config";

// Puck stores rich text as HTML and renders it as-is, so a page is cleaned
// on the server before it is published: only formatting tags, and links to
// site paths, https, mailto and tel. Anything else (scripts, iframes, event
// handlers, javascript: links, styles) is removed. Unknown block types are
// dropped too, so a hand-crafted request cannot smuggle in a component the
// editor does not offer.

const RICH: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "code", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"], p: ["style"], h2: ["style"], h3: ["style"], h4: ["style"] },
  // Text alignment from the editor's align buttons, nothing else.
  allowedStyles: { "*": { "text-align": [/^(left|center|right|justify)$/] } },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
      const href = attribs.href ?? "#";
      const attrs: sanitizeHtml.Attributes = { href };
      if (/^https:\/\//.test(href)) {
        attrs.target = "_blank";
        attrs.rel = "noopener noreferrer";
      }
      return { tagName, attribs: attrs };
    },
  },
};

export function cleanRichText(html: unknown): string {
  return sanitizeHtml(typeof html === "string" ? html : "", RICH);
}

type Item = { type: string; props: Record<string, unknown> };

function cleanItems(items: unknown): Item[] {
  if (!Array.isArray(items)) return [];
  const out: Item[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const { type, props } = raw as { type?: unknown; props?: unknown };
    if (typeof type !== "string" || !builderConfig.components[type]) continue;
    const fields = (builderConfig.components[type].fields ?? {}) as Record<string, { type?: string }>;
    const p: Record<string, unknown> = { ...((props as Record<string, unknown>) ?? {}) };
    for (const [name, field] of Object.entries(fields)) {
      if (field?.type === "richtext") p[name] = cleanRichText(p[name]);
      else if (field?.type === "slot") p[name] = cleanItems(p[name]);
    }
    out.push({ type, props: p });
  }
  return out;
}

/** A page's data, cleaned and validated for publishing. */
export function cleanPageData(data: unknown): PageData {
  const d = (data ?? {}) as Partial<PageData>;
  const zones: Record<string, Item[]> = {};
  for (const [k, v] of Object.entries((d.zones ?? {}) as Record<string, unknown>)) zones[k] = cleanItems(v);
  return {
    root: { props: { ...((d.root?.props as Record<string, unknown>) ?? {}) } },
    content: cleanItems(d.content),
    zones,
  };
}
