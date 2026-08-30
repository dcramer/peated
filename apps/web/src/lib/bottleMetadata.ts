import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";

export type BottleMetadata = Pick<
  Bottle,
  "abv" | "category" | "noAgeStatement" | "statedAge"
>;

export type BottleReviewMetadata = Pick<
  Bottle,
  "abv" | "releaseYear" | "statedAge" | "vintageYear"
>;

export function getBottleMetadata(bottle: BottleMetadata) {
  return [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
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
    bottle.vintageYear === null ? null : `${bottle.vintageYear} vintage`,
    bottle.releaseYear === null ? null : `${bottle.releaseYear} release`,
  ].filter((value): value is string => Boolean(value));
}
