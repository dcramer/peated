import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatReleaseDate } from "@peated/server/lib/bottleRelease";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { BottleListItem } from "@peated/web/components";

import { getReleaseFamilyHref } from "./releaseFamily";
import { getBottleUrl, getEntityUrl } from "./urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export type BottleListItemOptions = {
  includeBottler?: boolean;
  includeBrandInName?: boolean;
  includeBrandRow?: boolean;
  includeRatings?: boolean;
  includeRelatedReleases?: boolean;
  includeSeriesInName?: boolean;
};

/** Maps one API Bottle to the shared standard list presentation. */
export function toBottleListItem(
  bottle: Bottle,
  {
    includeBottler = false,
    includeBrandInName,
    includeBrandRow = true,
    includeRatings = false,
    includeRelatedReleases = false,
    includeSeriesInName = true,
  }: BottleListItemOptions = {},
): BottleListItem {
  const releaseDate = formatReleaseDate(bottle);
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    brand: includeBrandRow
      ? bottle.brand.shortName || bottle.brand.name
      : undefined,
    brandHref: includeBrandRow
      ? getEntityUrl({
          id: bottle.brand.id,
          kind: "brand",
          name: bottle.brand.name,
        })
      : undefined,
    hasTasted: bottle.hasTasted,
    href: getBottleUrl(bottle),
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
    metadata: [
      releaseDate ? `${releaseDate} release` : null,
      bottle.category ? formatCategoryName(bottle.category) : null,
      bottle.statedAge !== null
        ? `${bottle.statedAge} years`
        : bottle.noAgeStatement
          ? "No age statement"
          : null,
      bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
    ].filter((value): value is string => value !== null),
    name: formatBottleDisplayName(bottle, {
      includeBrand: includeBrandInName ?? !includeBrandRow,
      includeSeries: includeSeriesInName,
    }),
    ratings: includeRatings
      ? {
          counts: bottle.tastingBandCounts,
          high: bottle.maxScore,
          low: bottle.minScore,
          median: bottle.medianScore,
          scoreCount: bottle.scoreCount,
        }
      : undefined,
    relatedReleases:
      includeRelatedReleases && relatedReleaseCount > 1
        ? {
            count: relatedReleaseCount,
            href: getReleaseFamilyHref(bottle),
          }
        : undefined,
    subtitle:
      includeBottler && bottle.bottler && bottle.bottler.id !== bottle.brand.id
        ? `Bottled by ${bottle.bottler.shortName || bottle.bottler.name}`
        : undefined,
  };
}

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}
