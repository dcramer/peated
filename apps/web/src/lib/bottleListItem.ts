import {
  formatBottleDisplayName,
  getBottleReleaseMetadata,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type {
  BottleIdentityRowProps,
  BottleListItem,
} from "@peated/web/components";

import { getReleaseFamilyHref } from "./releaseFamily";
import { getBottleUrl, getEntityUrl } from "./urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export type BottleListItemOptions = {
  includeBottler?: boolean;
  includeBrandInName?: boolean;
  includeRatings?: boolean;
  includeRelatedReleases?: boolean;
  includeSeriesInName?: boolean;
};

export type BottleIdentitySource = BottleDisplayNameSource & {
  brand: BottleDisplayNameSource["brand"] & { id?: number };
} & Pick<Bottle, "abv" | "category" | "noAgeStatement" | "statedAge"> &
  Partial<Pick<Bottle, "bottler" | "distillers">>;

/** The same three identity lines apply to lists, selections, and partial Bottle reads. */
export function getBottleIdentityProps(
  bottle: BottleIdentitySource,
  {
    includeBottler = false,
    includeBrandInName = true,
    includeSeriesInName = true,
  }: Pick<
    BottleListItemOptions,
    "includeBottler" | "includeBrandInName" | "includeSeriesInName"
  > = {},
): Pick<BottleIdentityRowProps, "align" | "name" | "provenance" | "metadata"> {
  const releaseFact = getBottleReleaseMetadata(bottle);
  const releaseYear =
    bottle.releaseYear == null ? null : `${bottle.releaseYear} release`;
  return {
    align: "start",
    name: formatBottleDisplayName(bottle, {
      includeBrand: includeBrandInName,
      includeSeries: includeSeriesInName,
    }),
    provenance: [
      ...(bottle.distillers ?? [])
        .filter((distiller) => distiller.id !== bottle.brand.id)
        .map((distiller) => ({
          name: distiller.name,
          href: getEntityUrl(distiller),
        })),
      ...(includeBottler &&
      bottle.bottler &&
      bottle.bottler.id !== bottle.brand.id
        ? [
            {
              name: `Bottled by ${bottle.bottler.shortName || bottle.bottler.name}`,
              href: getEntityUrl(bottle.bottler),
            },
          ]
        : []),
      ...(bottle.category
        ? [{ name: formatCategoryName(bottle.category) }]
        : []),
    ],
    metadata: [
      releaseFact !== releaseYear ? releaseFact : null,
      releaseYear,
      bottle.statedAge !== null
        ? `${bottle.statedAge} years`
        : bottle.noAgeStatement
          ? "No age statement"
          : null,
      bottle.abv !== null ? `${bottle.abv.toFixed(1)}% ABV` : null,
    ].filter((value): value is string => value !== null),
  };
}

/** Owns the three-line identity used by every standard bottle row, including home and Library. */
export function toBottleListItem(
  bottle: Bottle,
  {
    includeBottler = false,
    includeBrandInName = true,
    includeRatings = false,
    includeRelatedReleases = false,
    includeSeriesInName = true,
  }: BottleListItemOptions = {},
): BottleListItem {
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    ...getBottleIdentityProps(bottle, {
      includeBottler,
      includeBrandInName,
      includeSeriesInName,
    }),
    hasTasted: bottle.hasTasted,
    href: getBottleUrl(bottle),
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
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
  };
}
