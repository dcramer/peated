import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { PageTabItem } from "@peated/web/components";
import type { BottleRailItem } from "@peated/web/components/pages/bottleRailSection.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";

type Bottle = Outputs["bottles"]["list"]["results"][number];

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

export function getLocationPopularBottles(
  bottles: readonly Bottle[],
): BottleRailItem[] {
  return bottles.map((bottle) => ({
    href: getBottleUrl(bottle),
    imageUrl: bottle.imageUrl,
    metadata: getBottleMetadata(bottle),
    name: formatBottleDisplayName(bottle),
  }));
}
