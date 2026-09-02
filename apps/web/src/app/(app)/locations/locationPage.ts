import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type {
  LocationPreviewCardProps,
  PageTabItem,
} from "@peated/web/components";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";
import { getEntityUrl } from "@peated/web/lib/urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];
type Distillery = Outputs["distilleries"]["list"]["results"][number];
type Region = Outputs["regions"]["list"]["results"][number];

export function getCountryLocationTabs({
  rootHref,
  totalBottles,
  totalDistillers,
}: {
  rootHref: string;
  totalBottles: number;
  totalDistillers: number;
}): readonly [PageTabItem, ...PageTabItem[]] {
  return [
    { href: rootHref, label: "Overview" },
    { count: totalBottles, href: `${rootHref}/bottles`, label: "Bottles" },
    {
      count: totalDistillers,
      href: `${rootHref}/distillers`,
      label: "Distillers",
    },
    { href: `${rootHref}/regions`, label: "Regions" },
  ];
}

export function getRegionLocationTabs({
  rootHref,
  totalBottles,
  totalDistillers,
}: {
  rootHref: string;
  totalBottles: number;
  totalDistillers: number;
}): readonly [PageTabItem, ...PageTabItem[]] {
  return [
    { href: rootHref, label: "Overview" },
    { count: totalBottles, href: `${rootHref}/bottles`, label: "Bottles" },
    {
      count: totalDistillers,
      href: `${rootHref}/distillers`,
      label: "Distillers",
    },
  ];
}

export function getLocationCategoryItems(
  results: readonly { category: string | null; count: number }[],
) {
  return results.flatMap(({ category, count }) =>
    category && count > 0
      ? [{ count, label: formatCategoryName(category) }]
      : [],
  );
}

export function getLocationLatestReleases(bottles: readonly Bottle[]) {
  return bottles.flatMap((bottle) =>
    bottle.releaseYear === null
      ? []
      : [
          toBottleListItem(bottle, {
            includeRatings: true,
            includeRelatedReleases: true,
          }),
        ],
  );
}

export function getLocationDistilleries(distilleries: readonly Distillery[]) {
  return distilleries.map((distillery) => ({
    href: getEntityUrl(distillery),
    location: [distillery.region?.name, distillery.country?.name]
      .filter(Boolean)
      .join(", "),
    name: distillery.name,
    totalBottles: distillery.totalBottles,
  }));
}

export function getLocationRegions(
  regions: readonly Region[],
): LocationPreviewCardProps[] {
  return regions.map((region) => ({
    description: region.description ?? undefined,
    href: `/locations/${region.country.slug}/regions/${region.slug}`,
    name: region.name,
    totalBottles: region.totalBottles,
    visual:
      region.country.slug === "united-states"
        ? { kind: "state", slug: region.slug }
        : { kind: "country", slug: region.country.slug },
  }));
}
