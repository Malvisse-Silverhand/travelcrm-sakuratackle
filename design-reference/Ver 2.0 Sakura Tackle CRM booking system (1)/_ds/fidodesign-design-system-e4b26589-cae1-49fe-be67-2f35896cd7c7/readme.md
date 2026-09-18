# FidoDesign Design System

FidoDesign is a solo freelance web design & development studio based in Malaysia, operating for 15+ years across 400+ projects and 130+ clients — mostly Malaysian/Singaporean corporate, engineering, construction, finance, and travel businesses. It builds on WordPress (Elementor and Breakdance page builders), and its own site, fidodesign.net, is both the marketing site and a portfolio: a homepage pitch plus one detail page per client project (screenshots, status, link to the live site).

There is one product surface: **the marketing/portfolio website**. No app, no dashboard, no separate docs site.

**Sources used** (read-only, may not be re-accessible):
- Homepage: https://fidodesign.net/ (fetched as text/markdown)
- Project detail page: https://fidodesign.net/web-design-for/metalflow-singapore/ (fetched as text/markdown)
- One user-supplied homepage screenshot (hero section) — the only pixel-level visual reference available; colors below were sampled directly from it
- No Figma file, codebase, or additional screenshots were provided

## Caveats
- Only the hero section of the homepage was seen in pixels. Everything below the fold (portfolio grid cards, stats bar, testimonial cards, footer) is a best-effort reconstruction from the page's text content plus the hero's visual language — not verified pixel-for-pixel.
- **No logo file was found or provided.** Do not treat "FD" mark / "FidoDesign" wordmark anywhere in this system as the real logo — it's plain type standing in for a mark. Replace with the real logo asset as soon as it's available.
- Fonts are inferred from the screenshot (rounded geometric sans, closest Google Font match: **Poppins** for display) and a practical UI pairing (**Inter** for body) — not confirmed against real webfont files. Loaded via Google Fonts CDN in `tokens/fonts.css`.
- The soft dot-grid + glow-blob background motif is an approximation of the faint dashboard-mockup graphics visible behind the homepage hero, not a copy of that specific artwork (which wasn't accessible as an asset).
- The exact lime-green accent hex is estimated from a low-resolution screenshot crop; treat it as approximate.

## Content fundamentals
- Voice is direct and benefit-led, addressing the reader as "you"/"your business": <cite>"With over 15 years of freelance experience, I deliver modern, high-performing sites tailored to your goals."</cite> First person "I" throughout (solo freelancer, not a "we" agency).
- Headlines use a confrontational hook + payoff structure: "Stop Settling for Templates — Get a Website Your Competitors Will Envy."
- Sentence case for headlines and body; ALL CAPS reserved for short service-tag pills (WEB DESIGN, SEO) and nav labels.
- No emoji in copy. Client testimonials mix English and Bahasa Malaysia verbatim (not translated) — e.g. "Servis terbaik! Pantas dan design yg awesome!" — reflecting the local client base.
- Numbers used as proof, not decoration: "15 Years", "400+ Projects", "130+ Clients" — sparingly, as trust stats, not scattered stats.
- Tone is warm and personally responsive ("I am highly responsive on WhatsApp... even outside office hours"), not corporate-agency.

## Visual foundations
- **Palette**: near-black void background (`--void`), one indigo-purple primary accent for the sole CTA per section, a lavender-white for headlines, muted slate-purple for body text, and a lime-green secondary accent used sparingly (status/highlight only, never as a second primary).
- **Type**: rounded geometric display face (Poppins) for headlines set in semibold, plain UI sans (Inter) for body and labels. Large, confident headline scale (36–60px); no all-caps display type.
- **Spacing**: 4px base scale (4 → 128), generous section padding (64–96px vertical rhythm).
- **Backgrounds**: solid near-black, no full-bleed photography on the homepage hero; a faint repeating dot grid plus soft out-of-focus color blobs (indigo/lime) suggest depth behind the hero copy. No hand-drawn illustration style.
- **Cards**: subtly raised surface (`--surface`, one step lighter than void), 1px low-opacity border, large radius (20px), soft ambient shadow — no colored left border, no drop-shadow-on-white pattern.
- **Buttons**: solid indigo primary with a soft indigo glow shadow (not a flat shadow), 14px radius (not a full pill), outlined secondary, text-only ghost/tertiary.
- **Badges/pills**: small, uppercase, translucent dark fill with a subtle border — used for service tags and status labels only.
- **Hover**: cards lift slightly (translateY) and reveal a dark scrim with "View Project"; buttons lift 1px, no color-darken pattern observed.
- **Corners**: buttons/pills small-to-medium radius (8–14px), cards larger (20px) — nothing fully squared, nothing pill-shaped except small tags.
- **Motion**: implied to be short and subtle (150–240ms) — no bounce or elaborate animation seen; treat as a fast, calm ease-out standard.
- **Imagery color vibe**: client project screenshots are the only imagery — full color, product-accurate (not stylized, warm, or desaturated).

## Iconography
- No custom icon font or SVG icon set was found on the site. Technology-partner and client logos are used as-is (their own marks), not restyled.
- The one interactive icon seen (a WhatsApp glyph on the primary CTA) is a third-party brand icon, not a house icon style.
- **No icon assets could be copied in** (external images weren't fetchable by available tools). If this system needs icons, substitute a CDN icon set with a similar plain, single-weight line style (e.g. Lucide) and flag it as a substitution — do not hand-draw icons.
- No logo, product photography, or illustration assets were copied into `assets/` for the same reason — the folder is currently empty aside from a debugging crop. **Do not invent a FidoDesign logo.**

## Index
- `styles.css` — root stylesheet, imports everything below
- `tokens/` — `fonts.css` (Google Fonts CDN import), `colors.css`, `typography.css`, `spacing.css`, `effects.css` (radius/shadow/motion)
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand groups)
- `components/core/` — `Button`, `Pill`, `ProjectCard`, `SectionHeading`, `StatBlock`, `TestimonialCard`
- `components/navigation/` — `NavBar`
- `ui_kits/marketing-site/` — click-through homepage + project detail page (`index.html`)
- `assets/` — empty; see Iconography above

### Intentional additions
None of the components above were defined by an attached source (no codebase/Figma) — they were authored from scratch to cover what the marketing site actually needs (button, tag, project card, stat, testimonial, section header, nav). No component beyond that set was added.
