// Published reviews, as the public site shows them (get_published_reviews:
// no booking or contact details). Ratings appear only once a boat, or the
// business, has at least one published review.

export type PublicReview = {
  id: string;
  name: string;
  rating: number;
  comment: string | null;
  boat_id: string | null;
  boat_code: string | null;
  trip_date: string;
  created_at: string;
};

export type Rating = { avg: number; count: number };

export type RatingSummary = {
  overall: Rating | null;
  byBoat: Record<string, Rating>;
};

export function summarise(reviews: PublicReview[]): RatingSummary {
  const sum = (rs: PublicReview[]): Rating => ({
    avg: rs.reduce((s, r) => s + r.rating, 0) / rs.length,
    count: rs.length,
  });
  const byBoat: Record<string, Rating> = {};
  const groups = new Map<string, PublicReview[]>();
  for (const r of reviews) {
    if (!r.boat_id) continue;
    groups.set(r.boat_id, [...(groups.get(r.boat_id) ?? []), r]);
  }
  for (const [id, rs] of groups) byBoat[id] = sum(rs);
  return { overall: reviews.length ? sum(reviews) : null, byBoat };
}

export const ratingText = (r: Rating) => `${r.avg.toFixed(1)} (${r.count} ulasan)`;
