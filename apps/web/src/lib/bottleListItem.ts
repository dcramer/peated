import {
  formatAbv,
  formatBottleDisplayName,
  formatBottleLabel,
  nameIncludes,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import type { BottleIdentityRowProps } from "@peated/web/components/bottleIdentityRow.stylex";
import type { BottleListItem } from "@peated/web/components/bottleList.stylex";
import type { SearchPickerOption } from "@peated/web/components/searchPicker.stylex";

import { nameIncludesAge } from "./bottleMetadata";
import { getReleaseFamilyHref } from "./releaseFamily";
import { getBottleSeriesUrl, getBottleUrl, getEntityUrl } from "./urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];
type Entity = NonNullable<Bottle["bottler"]>;

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
  /** A distiller added in a form has no page yet, so it has no ID or link. */
  distillers?: readonly {
    id: number | null;
    kind: Entity["kind"] | null;
    name: string;
  }[];
} & Pick<Bottle, "abv" | "noAgeStatement" | "statedAge"> &
  Partial<Pick<Bottle, "bottler">>;

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
    !nameIncludes(name, bottle.series.name)
      ? bottle.series
      : null;
  // Bottle Presentation: a row shows the edition and at most one year,
  // vintage before release, that the name does not already print.
  const year =
    bottle.vintageYear != null
      ? { value: bottle.vintageYear, label: "vintage" }
      : bottle.releaseYear != null
        ? { value: bottle.releaseYear, label: "release" }
        : null;
  const yearFact =
    year && !nameIncludes(name, String(year.value))
      ? `${year.value} ${year.label}`
      : null;
  const abv = bottle.abv !== null ? formatAbv(bottle.abv) : null;
  // The brand already identifies its own distillery, so it is never listed or
  // counted.
  const distillers = (bottle.distillers ?? []).filter(
    (distiller) => distiller.id !== bottle.brand.id,
  );
  const distillerProvenance =
    distillers.length > 3
      ? [
          {
            name: `${distillers.length.toLocaleString("en-US")} distilleries`,
            title: distillers.map((distiller) => distiller.name).join(" · "),
          },
        ]
      : distillers.map(({ id, kind, name }) =>
          id === null
            ? { name }
            : { name, href: getEntityUrl({ id, kind, name }) },
        );

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
    // Bottle Presentation: age and ABV show once, so values the name already
    // prints stay out of the metadata line.
    metadata: [
      bottle.edition || null,
      yearFact,
      bottle.statedAge !== null
        ? nameIncludesAge(name, bottle.statedAge)
          ? null
          : `${bottle.statedAge} years`
        : bottle.noAgeStatement
          ? "NAS"
          : null,
      abv && !nameIncludes(name, abv) ? abv : null,
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
