import type { Metadata } from "next";
import { Suspense } from "react";
import FleetReview from "./FleetReview";

// Review page for the low-poly fleet, before the models go into the booking
// pages. Operator-facing, so English; kept out of search results.
export const metadata: Metadata = {
  title: "Fleet model review | Sakura Tackle",
  robots: { index: false, follow: false },
};

export default function FleetPreviewPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <FleetReview />
    </Suspense>
  );
}
