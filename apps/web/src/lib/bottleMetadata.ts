import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";

export type BottleMetadata = Pick<
  Bottle,
  "abv" | "category" | "noAgeStatement" | "statedAge"
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
