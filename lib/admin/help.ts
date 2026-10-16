import topicsData from "./help-topics.json";
import markersData from "./help-markers.json";

// The Help center: topics and their text live in help-topics.json; the
// screenshots (public/help/<slug>.jpg) and marker positions
// (help-markers.json) are generated from the real admin by
// scripts/help-shots.mjs.

export type HelpCallout = { selector: string; title: string; body: string };

export type HelpTopic = {
  slug: string;
  group: string;
  title: string;
  path: string;
  intro: string;
  callouts: HelpCallout[];
};

export type HelpMarkers = {
  width: number;
  height: number;
  /** Per callout, in % of the picture; null when the element was missing. */
  points: Array<{ x: number; y: number } | null>;
};

export const HELP_TOPICS: HelpTopic[] = topicsData.topics;

const MARKERS: Record<string, HelpMarkers> = markersData;

export function helpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}

export function helpMarkers(slug: string): HelpMarkers | undefined {
  return MARKERS[slug];
}

/** Which topics a role sees: editors only the website ones (and getting
 *  started); vendors everything except the website; admins everything. */
export function topicVisibleTo(t: HelpTopic, role: "admin" | "vendor" | "editor"): boolean {
  if (role === "admin") return true;
  if (role === "editor") return t.group === "Website" || t.slug === "getting-started";
  return t.group !== "Website";
}

/** Topics grouped by menu section, in file order. */
export function helpGroups(role: "admin" | "vendor" | "editor" = "admin"): Array<{ group: string; topics: HelpTopic[] }> {
  const out: Array<{ group: string; topics: HelpTopic[] }> = [];
  for (const t of HELP_TOPICS.filter((x) => topicVisibleTo(x, role))) {
    const g = out.find((x) => x.group === t.group);
    if (g) g.topics.push(t);
    else out.push({ group: t.group, topics: [t] });
  }
  return out;
}
