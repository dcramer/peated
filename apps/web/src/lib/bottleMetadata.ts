import {
  getBottleReleaseMetadata,
  isBatchEdition,
} from "@peated/server/lib/bottleDisplayName";
import { formatReleaseDate } from "@peated/server/lib/bottleRelease";
import type { Bottle } from "@peated/server/types";

export type BottleReviewMetadata = Pick<
  Bottle,
  "abv" | "edition" | "releaseYear" | "statedAge" | "vintageYear"
>;

type BottleReleasePlacement = Pick<
  Bottle,
  "edition" | "releaseDay" | "releaseMonth" | "releaseYear"
>;

/** Keeps one release date on the page while retaining batch and date context. */
export function getBottleReleasePlacement(bottle: BottleReleasePlacement) {
  const releaseDate = formatReleaseDate(bottle);
  return isBatchEdition(bottle.edition)
    ? { header: bottle.edition, details: releaseDate }
    : { header: releaseDate, details: null };
}

/** Returns the compact facts that distinguish one reviewed release from another. */
export function getBottleReviewMetadata(bottle: BottleReviewMetadata) {
  return [
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null
      ? null
      : `${bottle.abv.toFixed(1).replace(/\.0$/, "")}% ABV`,
    getBottleReleaseMetadata(bottle),
  ].filter((value): value is string => Boolean(value));
}
