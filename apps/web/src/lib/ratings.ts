import type { RatingSystem, SimpleRatingValue } from "@peated/server/constants";

export function getInitialRatingSystem({
  rating,
  score,
  preference,
}: {
  rating?: SimpleRatingValue | null;
  score?: number | null;
  preference?: RatingSystem;
}): RatingSystem {
  if (score !== null && score !== undefined) return "advanced";
  if (rating !== null && rating !== undefined) return "simple";
  return preference ?? "simple";
}
