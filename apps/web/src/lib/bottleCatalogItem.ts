import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { BottleCatalogItem } from "@peated/web/components/pages/bottleCatalog.stylex";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { getReleaseFamilyHref } from "./releaseFamily";
import { getEntityUrl } from "./urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export function toBottleCatalogItem(bottle: Bottle): BottleCatalogItem {
  const metadata = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "No age statement"
        : null,
    bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
    `${bottle.totalTastings.toLocaleString("en-US")} ${bottle.totalTastings === 1 ? "tasting" : "tastings"}`,
  ].filter((value): value is string => value !== null);
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    bandCounts: bottle.tastingBandCounts,
    brand: bottle.brand.name,
    brandHref: getEntityUrl({ id: bottle.brand.id, kind: "brand" }),
    hasTasted: bottle.hasTasted,
    href: `/bottles/${bottle.id}`,
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
    metadata,
    name: formatBottleDisplayName(bottle, { includeBrand: false }),
    relatedReleases:
      relatedReleaseCount > 1
        ? {
            count: relatedReleaseCount,
            href: getReleaseFamilyHref(bottle.id),
          }
        : undefined,
    medianScore: bottle.medianScore,
    scoreHigh: bottle.maxScore,
    scoreLow: bottle.minScore,
    scoreCount: bottle.scoreCount,
  };
}

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}
