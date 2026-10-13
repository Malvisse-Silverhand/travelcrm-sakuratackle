import type { ReactNode } from "react";

// One small line icon per on-board facility, keyed by the `icon` field in
// lib/content/site.ts. Drawn on a 24px grid, stroked in currentColor.

export type FacilityIconName =
  | "sonar"
  | "meal"
  | "group"
  | "cooler"
  | "lifering"
  | "lamp"
  | "jig"
  | "rest";

const PATHS: Record<FacilityIconName, ReactNode> = {
  sonar: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
  meal: (
    <>
      <path d="M3 12h18a9 9 0 0 1-18 0Z" />
      <path d="M9 4c0 1.5 1 1.5 1 3M13 4c0 1.5 1 1.5 1 3" />
    </>
  ),
  group: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14.2a5 5 0 0 1 5 5.8" />
    </>
  ),
  cooler: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M3 13h18M9 9V6h6v3" />
    </>
  ),
  lifering: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="m5.6 5.6 3.6 3.6M18.4 5.6l-3.6 3.6M5.6 18.4l3.6-3.6M18.4 18.4l-3.6-3.6" />
    </>
  ),
  lamp: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </>
  ),
  jig: (
    <>
      <path d="M12 2v4" />
      <path d="M9 6h6l-1 9H10Z" />
      <path d="M10 15l-2 4M12 15v5M14 15l2 4" />
    </>
  ),
  rest: (
    <>
      <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
      <circle cx="7" cy="11" r="2" />
    </>
  ),
};

export default function FacilityIcon({ name }: { name: FacilityIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
