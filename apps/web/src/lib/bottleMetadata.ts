import {
  getBottleReleaseMetadata,
  isBatchEdition,
} from "@peated/server/lib/bottleDisplayName";
import { formatReleaseDate } from "@peated/server/lib/bottleRelease";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";

export type BottleMetadata = Pick<
  Bottle,
  "abv" | "category" | "noAgeStatement" | "statedAge"
> &
  Partial<Pick<Bottle, "edition" | "releaseYear" | "vintageYear">>;

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

export function getBottleMetadata(bottle: BottleMetadata) {
  return [
    getBottleReleaseMetadata(bottle),
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "No age statement"
        : null,
    bottle.abv !== null
      ? `${bottle.abv.toFixed(1).replace(/\.0$/, "")}% ABV`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
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
