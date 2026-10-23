import {
  formatAbv,
  formatBottleDisplayName,
  formatBottleLabel,
  getBottleReleaseMetadata,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import type { BottleIdentityRowProps } from "@peated/web/components/bottleIdentityRow.stylex";
import type { BottleListItem } from "@peated/web/components/bottleList.stylex";
import type { SearchPickerOption } from "@peated/web/components/searchPicker.stylex";

import { getReleaseFamilyHref } from "./releaseFamily";
import { getBottleSeriesUrl, getBottleUrl, getEntityUrl } from "./urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export type BottleListItemOptions = {
  includeBottler?: boolean;
  includeBrandInName?: boolean;
  includeRatings?: boolean;
  includeRelatedReleases?: boolean;
  /**
   * Where the series shows: first on the provenance line (the default), in the
   * name for rows that hide provenance, or nowhere when the page is the series.
   */
  seriesPlacement?: "provenance" | "name" | "none";
};

export type BottleIdentitySource = Omit<BottleDisplayNameSource, "series"> & {
  brand: BottleDisplayNameSource["brand"] & { id?: number };
  /** A draft series may not have a page yet, so the link is optional. */
  series?: { name: string; id?: number; fullName?: string } | null;
} & Pick<Bottle, "abv" | "noAgeStatement" | "statedAge"> &
  Partial<Pick<Bottle, "bottler" | "distillers">>;

// Whole numbers only, so `1982` is not found in `19821`.
function nameIncludesYear(name: string, year: number) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${year}(?![\\p{L}\\p{N}])`, "u").test(
    name,
  );
}

/** Selection controls own navigation; bottle content must not contain nested links. */
export function toBottlePickerOption(
  bottle: BottleIdentitySource & Pick<Bottle, "id" | "imageUrl">,
): SearchPickerOption & {
  id: number;
  bottle: NonNullable<SearchPickerOption["bottle"]>;
} {
  const identity = getBottleIdentityProps(bottle);
  return {
    id: bottle.id,
    label: formatBottleLabel(bottle),
    bottle: {
      ...identity,
      imageUrl: bottle.imageUrl,
      provenance: identity.provenance?.map(({ name, title }) =>
        title ? { name, title } : { name },
      ),
    },
  };
}

/** The same three identity lines apply to lists, selections, and partial Bottle reads. */
export function getBottleIdentityProps(
  bottle: BottleIdentitySource,
  {
    includeBottler = false,
    includeBrandInName = true,
    seriesPlacement = "provenance",
  }: Pick<
    BottleListItemOptions,
    "includeBottler" | "includeBrandInName" | "seriesPlacement"
  > = {},
): Pick<BottleIdentityRowProps, "abv" | "name" | "provenance" | "metadata"> {
  const name = formatBottleDisplayName(bottle, {
    includeBrand: includeBrandInName,
    includeSeries: seriesPlacement === "name",
  });
  const series =
    seriesPlacement === "provenance" &&
    bottle.series &&
    !name.toLocaleLowerCase().includes(bottle.series.name.toLocaleLowerCase())
      ? bottle.series
      : null;
  // Bottle Presentation: a year the name already prints is not repeated.
  const yearNotInName = (year: number | null | undefined) =>
    year != null && !nameIncludesYear(name, year);
  const releaseFact =
    bottle.edition || yearNotInName(bottle.vintageYear ?? bottle.releaseYear)
      ? getBottleReleaseMetadata(bottle)
      : null;
  const abv = bottle.abv !== null ? formatAbv(bottle.abv) : null;
  const releaseYear = yearNotInName(bottle.releaseYear)
    ? `${bottle.releaseYear} release`
    : null;
  const distillers = bottle.distillers ?? [];
  const distillerProvenance =
    distillers.length > 3
      ? [
          {
            name: `${distillers.length.toLocaleString("en-US")} distilleries`,
            title: distillers.map((distiller) => distiller.name).join(" · "),
          },
        ]
      : distillers
          .filter((distiller) => distiller.id !== bottle.brand.id)
          .map((distiller) => ({
            name: distiller.name,
            href: getEntityUrl(distiller),
          }));

  return {
    name,
    // Bottle Presentation: series leads the provenance line, as whisky
    // drinkers name a bottler's range before its distillery.
    provenance: [
      ...(series
        ? [
            series.id !== undefined && series.fullName !== undefined
              ? {
                  name: series.name,
                  href: getBottleSeriesUrl({
                    id: series.id,
                    fullName: series.fullName,
                  }),
                }
              : { name: series.name },
          ]
        : []),
      ...distillerProvenance,
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
    ],
    metadata: [
      releaseFact !== releaseYear ? releaseFact : null,
      releaseYear,
      bottle.statedAge !== null
        ? `${bottle.statedAge} years`
        : bottle.noAgeStatement
          ? "NAS"
          : null,
      abv,
    ].filter((value): value is string => value !== null),
    abv,
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
    seriesPlacement = "provenance",
  }: BottleListItemOptions = {},
): BottleListItem {
  const relatedReleaseCount = bottle.group?.totalBottles ?? 1;

  return {
    ...getBottleIdentityProps(bottle, {
      includeBottler,
      includeBrandInName,
      seriesPlacement,
    }),
    hasTasted: bottle.hasTasted,
    href: getBottleUrl(bottle),
    id: bottle.peatedId,
    imageUrl: bottle.imageUrl,
    isLibrary: bottle.isLibrary,
    ratings: includeRatings
      ? {
          maxScore: bottle.maxScore,
          median: bottle.medianScore,
          minScore: bottle.minScore,
          raterCount: bottle.raterCount,
          scoreCount: bottle.scoreCount,
          tastingCounts: bottle.tastingBandCounts,
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
