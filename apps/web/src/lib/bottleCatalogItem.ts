import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { BottleCatalogItem } from "@peated/web/components/designSystem/patterns/bottleCatalog.stylex";

import { getBottleExpressionName } from "./bottleLabel";
import { getReleaseFamilyHref } from "./releaseFamily";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export function toBottleCatalogItem(bottle: Bottle): BottleCatalogItem {
  const metadata = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
        : null,
    bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
    `${bottle.totalTastings.toLocaleString("en-US")} ${bottle.totalTastings === 1 ? "tasting" : "tastings"}`,
  ].filter((value): value is string => value !== null);
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    bandCounts: bottle.tastingBandCounts,
    brand: bottle.brand.name,
    brandHref: `/entities/${bottle.brand.id}`,
    hasTasted: bottle.hasTasted,
    href: `/bottles/${bottle.id}`,
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
    metadata,
    name: bottle.group?.name ?? getBottleExpressionName(bottle),
    relatedReleases:
      relatedReleaseCount > 1
        ? {
            count: relatedReleaseCount,
            href: getReleaseFamilyHref(bottle.id),
          }
        : undefined,
    medianScore: bottle.medianScore,
    scoreCount: bottle.scoreCount,
  };
}

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}
