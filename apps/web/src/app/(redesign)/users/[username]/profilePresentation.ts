import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";

type Bottle = Outputs["tastings"]["list"]["results"][number]["bottle"];

export function getProfileBottleMetadata(bottle: Bottle) {
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
