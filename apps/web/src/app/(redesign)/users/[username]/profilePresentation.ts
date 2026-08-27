import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { Verdict } from "@peated/web/components/designSystem/components";

type Bottle = Outputs["tastings"]["list"]["results"][number]["bottle"];

export function getProfileVerdict(rating: number | null): Verdict | undefined {
  if (rating === SIMPLE_RATING_VALUES.PASS) return "pass";
  if (rating === SIMPLE_RATING_VALUES.SIP) return "sip";
  if (rating === SIMPLE_RATING_VALUES.SAVOR) return "savor";
  return undefined;
}

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
